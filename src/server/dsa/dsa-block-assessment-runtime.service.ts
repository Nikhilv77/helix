import { DsaPracticeBlockStatus, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import {
  DSA_BLOCK_ASSESSMENT_SNAPSHOT_VERSION,
  parseDsaBlockAssessmentSnapshot,
  type DsaBlockAssessmentSnapshot,
  type DsaBlockAssessmentTransferQuestion
} from "@/lib/dsa/block-assessment";
import type { InterviewService } from "@/server/interview/interview.service";
import type { InterviewSetup, PlannedQuestion, Role, Level } from "@/server/interview/types";
import type { PrismaService } from "@/server/database/prisma.service";
import type { CodeTestCase } from "./code-test-harness";
import {
  DsaBlockAssessmentPreparationError,
  DsaBlockAssessmentPreparationService
} from "./dsa-block-assessment-preparation.service";

export class DsaBlockAssessmentRuntimeError extends Error {
  constructor(
    readonly code:
      | "BLOCK_NOT_FOUND"
      | "ASSESSMENT_NOT_READY"
      | "ASSESSMENT_SNAPSHOT_INVALID"
      | "ASSESSMENT_SESSION_NOT_FOUND"
      | "ASSESSMENT_QUESTION_MISMATCH",
    message: string
  ) {
    super(message);
    this.name = "DsaBlockAssessmentRuntimeError";
  }
}

export type FrozenTransferQuestion = DsaBlockAssessmentTransferQuestion & {
  runnerContract: { version: 1; functionName: string; testCases: CodeTestCase[] };
};

/**
 * The boundary between an immutable assessment snapshot and the live
 * interview. The database snapshot remains the authority for answer keys and
 * runner configuration; the interview state contains only renderable fields.
 */
export class DsaBlockAssessmentRuntimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly preparation: DsaBlockAssessmentPreparationService,
    private readonly interviews: InterviewService
  ) {}

  async startOrResume(
    ownerId: string,
    requestedBlockId?: string
  ): Promise<{ sessionId: string; created: boolean }> {
    // Preparation is idempotent. Once the session is in progress the existing
    // snapshot is loaded below instead; preparation correctly refuses a
    // non-ready block and must not be used as a fallback source.
    const current = await this.currentAssessment(ownerId, requestedBlockId);
    if (current.status === DsaPracticeBlockStatus.ASSESSMENT_READY) {
      await this.preparation.prepareCurrent(ownerId);
    }

    // Commit a deterministic reservation before creating the session. Session
    // creation uses the session store's own Prisma write, so it cannot safely
    // share this transaction. A retry therefore always reuses this UUID after
    // a crash/failure between creation and lifecycle finalisation.
    const reserved = await this.prisma.$transaction(
      async (tx) => {
        await lockOwner(tx, ownerId);
        const block = await tx.dsaPracticeBlock.findFirst({
          where: {
            ownerId,
            isCurrent: true,
            ...(requestedBlockId ? { id: requestedBlockId } : {})
          },
          select: runtimeBlockSelect
        });
        if (!block) {
          throw new DsaBlockAssessmentRuntimeError(
            "BLOCK_NOT_FOUND",
            "No current DSA block exists."
          );
        }
        if (
          block.status !== DsaPracticeBlockStatus.ASSESSMENT_READY &&
          block.status !== DsaPracticeBlockStatus.ASSESSMENT_IN_PROGRESS
        ) {
          throw new DsaBlockAssessmentRuntimeError(
            "ASSESSMENT_NOT_READY",
            "Complete the current DSA block before starting its assessment."
          );
        }
        if (!block.assessment?.assessmentSnapshot) {
          throw new DsaBlockAssessmentRuntimeError(
            "ASSESSMENT_SNAPSHOT_INVALID",
            "The prepared assessment snapshot is unavailable."
          );
        }
        const snapshot = readSnapshot(block.assessment.assessmentSnapshot, block.id);
        assertRunnableSnapshot(snapshot);

        const sessionId = block.assessment.interviewSessionId ?? randomUUID();
        if (!block.assessment.interviewSessionId) {
          await tx.dsaBlockAssessment.update({
            where: { id: block.assessment.id },
            data: { interviewSessionId: sessionId }
          });
        }
        return { block, snapshot, sessionId };
      },
      { maxWait: 20_000, timeout: 120_000 }
    );

    const setup = buildAssessmentSetup(
      reserved.block.id,
      reserved.block.assessment!.id,
      reserved.snapshot,
      reserved.block.owner
    );
    const reservedSession = await this.prisma.interviewSession.findFirst({
      where: { id: reserved.sessionId },
      select: { ownerId: true }
    });
    if (reservedSession && reservedSession.ownerId !== ownerId) {
      throw new DsaBlockAssessmentRuntimeError(
        "ASSESSMENT_SESSION_NOT_FOUND",
        "The reserved assessment session belongs to a different candidate."
      );
    }
    let started: Awaited<ReturnType<InterviewService["start"]>>;
    try {
      started = await this.interviews.start(
        setup,
        ownerId,
        Date.now(),
        buildAssessmentPlan(reserved.snapshot),
        reserved.sessionId
      );
    } catch (error) {
      // A concurrent caller can win the deterministic-ID insert between this
      // caller's reuse read and create. Retry once: `start` now observes the
      // owned session and returns it without consuming another quota slot.
      try {
        started = await this.interviews.start(
          setup,
          ownerId,
          Date.now(),
          buildAssessmentPlan(reserved.snapshot),
          reserved.sessionId
        );
      } catch {
        throw error;
      }
    }

    return this.prisma.$transaction(
      async (tx) => {
        await lockOwner(tx, ownerId);
        const block = await tx.dsaPracticeBlock.findFirst({
          where: {
            ownerId,
            isCurrent: true,
            ...(requestedBlockId ? { id: requestedBlockId } : {})
          },
          select: runtimeBlockSelect
        });
        if (!block?.assessment || block.id !== reserved.block.id) {
          throw new DsaBlockAssessmentRuntimeError(
            "BLOCK_NOT_FOUND",
            "The current DSA block changed."
          );
        }
        if (block.assessment.interviewSessionId !== reserved.sessionId) {
          throw new DsaBlockAssessmentRuntimeError(
            "ASSESSMENT_SESSION_NOT_FOUND",
            "This assessment session reservation does not match the current block."
          );
        }
        const attached = await tx.interviewSession.findFirst({
          where: { id: reserved.sessionId, ownerId },
          select: { id: true }
        });
        if (!attached) {
          // Do not clear the reservation: the only safe retry is to create or
          // recover this same UUID, never a second orphanable session.
          throw new DsaBlockAssessmentRuntimeError(
            "ASSESSMENT_SESSION_NOT_FOUND",
            "The reserved assessment session could not be recovered."
          );
        }
        if (block.status !== DsaPracticeBlockStatus.ASSESSMENT_IN_PROGRESS) {
          const now = new Date();
          await tx.dsaBlockAssessment.update({
            where: { id: block.assessment.id },
            data: { startedAt: block.assessment.startedAt ?? now }
          });
          await tx.dsaPracticeBlock.update({
            where: { id: block.id },
            data: { status: DsaPracticeBlockStatus.ASSESSMENT_IN_PROGRESS }
          });
        }
        return { sessionId: started.state.id, created: started.created };
      },
      { maxWait: 20_000, timeout: 120_000 }
    );
  }

  /** Server-only MCQ key lookup. The answer key is never copied into state. */
  async gradeReviewAnswer(
    ownerId: string | undefined,
    setup: InterviewSetup,
    reviewItemId: string,
    answer: string
  ): Promise<{ correct: boolean; explanation: string } | null> {
    const identity = setup.dsaBlockAssessment;
    if (!identity || identity.kind !== "dsa-block-assessment") return null;
    const assessment = await this.prisma.dsaBlockAssessment.findFirst({
      where: {
        id: identity.assessmentId,
        ...(ownerId ? { ownerId } : {}),
        blockId: identity.blockId
      },
      select: { assessmentSnapshot: true }
    });
    if (!assessment?.assessmentSnapshot) {
      throw new DsaBlockAssessmentRuntimeError(
        "ASSESSMENT_SNAPSHOT_INVALID",
        "The saved assessment answer key is unavailable."
      );
    }
    const snapshot = readSnapshot(assessment.assessmentSnapshot, identity.blockId);
    const item = snapshot.reviewItems.find((candidate) => candidate.id === reviewItemId);
    if (!item) {
      throw new DsaBlockAssessmentRuntimeError(
        "ASSESSMENT_QUESTION_MISMATCH",
        "That review question does not belong to this assessment."
      );
    }
    const selected = item.options.findIndex(
      (option) => option.trim().toLowerCase() === answer.trim().toLowerCase()
    );
    return { correct: selected === item.correctOption, explanation: item.rationale };
  }

  /**
   * Resolves runner data only through an owned assessment session. Never use a
   * browser slug here: the immutable snapshot decides what code is executed.
   */
  async frozenTransferForRun(
    ownerId: string,
    sessionId: string,
    questionIndex: number
  ): Promise<FrozenTransferQuestion | null> {
    const assessment = await this.prisma.dsaBlockAssessment.findFirst({
      where: { ownerId, interviewSessionId: sessionId },
      select: { blockId: true, assessmentSnapshot: true }
    });
    if (!assessment) return null;
    if (!assessment.assessmentSnapshot) {
      throw new DsaBlockAssessmentRuntimeError(
        "ASSESSMENT_SNAPSHOT_INVALID",
        "The saved transfer problem is unavailable."
      );
    }
    const snapshot = readSnapshot(assessment.assessmentSnapshot, assessment.blockId);
    const reviewCount = snapshot.reviewItems.length;
    const session = await this.prisma.interviewSession.findFirst({
      where: { id: sessionId, ownerId },
      select: { state: true }
    });
    const state = session?.state;
    if (
      !state ||
      typeof state !== "object" ||
      !isActiveAssessmentQuestion(state, assessment.blockId, questionIndex)
    ) {
      throw new DsaBlockAssessmentRuntimeError(
        "ASSESSMENT_QUESTION_MISMATCH",
        "That coding problem is not the active assessment question."
      );
    }
    const transfer = snapshot.transferQuestions[questionIndex - reviewCount];
    if (!transfer) {
      throw new DsaBlockAssessmentRuntimeError(
        "ASSESSMENT_QUESTION_MISMATCH",
        "That coding problem is not active in this assessment."
      );
    }
    if (!transfer.runnerContract || transfer.runnerContract.version !== 1) {
      throw new DsaBlockAssessmentRuntimeError(
        "ASSESSMENT_SNAPSHOT_INVALID",
        "This legacy assessment has no frozen code-runner contract."
      );
    }
    return {
      ...transfer,
      runnerContract: {
        version: 1,
        functionName: transfer.runnerContract.functionName,
        testCases: transfer.runnerContract.testCases as CodeTestCase[]
      }
    };
  }

  private async currentAssessment(ownerId: string, requestedBlockId?: string) {
    const block = await this.prisma.dsaPracticeBlock.findFirst({
      where: {
        ownerId,
        isCurrent: true,
        ...(requestedBlockId ? { id: requestedBlockId } : {})
      },
      select: { id: true, status: true }
    });
    if (!block) {
      throw new DsaBlockAssessmentRuntimeError("BLOCK_NOT_FOUND", "No current DSA block exists.");
    }
    return block;
  }
}

function isActiveAssessmentQuestion(
  value: object,
  blockId: string,
  questionIndex: number
): boolean {
  const state = value as {
    questionIndex?: unknown;
    setup?: { dsaBlockAssessment?: { kind?: unknown; blockId?: unknown } };
  };
  return (
    state.questionIndex === questionIndex &&
    state.setup?.dsaBlockAssessment?.kind === "dsa-block-assessment" &&
    state.setup.dsaBlockAssessment.blockId === blockId
  );
}

const runtimeBlockSelect = {
  id: true,
  ownerId: true,
  status: true,
  owner: { select: { targetRole: true, level: true, context: true } },
  assessment: {
    select: { id: true, assessmentSnapshot: true, interviewSessionId: true, startedAt: true }
  }
} satisfies Prisma.DsaPracticeBlockSelect;

function readSnapshot(value: unknown, blockId: string): DsaBlockAssessmentSnapshot {
  try {
    const snapshot = parseDsaBlockAssessmentSnapshot(value);
    if (snapshot.blockId !== blockId) throw new Error("block mismatch");
    return snapshot;
  } catch {
    throw new DsaBlockAssessmentRuntimeError(
      "ASSESSMENT_SNAPSHOT_INVALID",
      "The saved assessment snapshot is invalid."
    );
  }
}

function assertRunnableSnapshot(snapshot: DsaBlockAssessmentSnapshot): void {
  if (
    snapshot.schemaVersion < DSA_BLOCK_ASSESSMENT_SNAPSHOT_VERSION ||
    snapshot.transferQuestions.some((question) => !question.runnerContract || !question.starterCode)
  ) {
    throw new DsaBlockAssessmentRuntimeError(
      "ASSESSMENT_SNAPSHOT_INVALID",
      "This saved assessment predates the frozen runner contract and cannot be started safely."
    );
  }
}

export function buildAssessmentSetup(
  blockId: string,
  assessmentId: string,
  snapshot: DsaBlockAssessmentSnapshot,
  owner: { targetRole: string | null; level: string | null; context: string | null }
): InterviewSetup {
  return {
    role: asRole(owner.targetRole),
    level: asLevel(owner.level),
    roundType: "technical",
    intensity: "realistic",
    context: [
      "This is a frozen DSA block assessment. Ask the prepared questions in order.",
      "The first stage is candidate-code review; the final two are transfer coding problems.",
      owner.context ?? ""
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 1_200),
    templateId: "dsa-block-assessment",
    templateTitle: "DSA block assessment",
    durationMinutes: snapshot.durationMinutes,
    questionCount: (snapshot.reviewItems.length + snapshot.transferQuestions.length) as 7 | 8,
    dsaBlockAssessment: {
      kind: "dsa-block-assessment",
      blockId,
      assessmentId,
      snapshotVersion: snapshot.schemaVersion,
      rubricVersion: snapshot.rubricVersion
    }
  };
}

export function buildAssessmentPlan(snapshot: DsaBlockAssessmentSnapshot): PlannedQuestion[] {
  const review = snapshot.reviewItems.map((item) => ({
    text: item.prompt,
    evidenceAnchor: `Your verified submission for ${item.sourceQuestionTitle}`,
    kind: "mcq" as const,
    stage: "rapid" as const,
    codeSnippet: item.codeSnippet,
    dsaAssessmentReviewItemId: item.id,
    options: [...item.options],
    answerFormat: "mcq" as const,
    competency: item.metric,
    intent: "Assess the candidate's reasoning about their verified code.",
    mustHit: ["Select the best grounded answer."],
    probeIfMissing: "Choose the option that best matches the code shown."
  }));
  const transfer = snapshot.transferQuestions.map((question) => ({
    text: `Now solve this transfer problem: ${question.title}. Explain your approach and complexity, then send your code when ready.`,
    evidenceAnchor: `${question.primaryPattern} transfer problem frozen for this block assessment`,
    kind: "code" as const,
    stage: "code" as const,
    language: "javascript",
    codeTask: question.problemStatement ?? question.promptSummary,
    codeSnippet: "",
    dsaTransferQuestion: publicTransferQuestion(question),
    answerFormat: "typed" as const,
    competency: question.primaryPattern,
    rubricKeys: [
      "pattern-recognition",
      "correctness-edge-cases",
      "efficiency",
      "code-quality",
      "communication"
    ],
    intent: "Assess transfer of the block's patterns to an unseen authored problem.",
    mustHit: ["working implementation", "approach", "time and space complexity"],
    probeIfMissing: "Walk me through the data structure and complexity trade-offs in your solution."
  }));
  return [...review, ...transfer];
}

function publicTransferQuestion(
  question: DsaBlockAssessmentTransferQuestion
): NonNullable<PlannedQuestion["dsaTransferQuestion"]> {
  return {
    slug: question.slug,
    title: question.title,
    primaryPattern: question.primaryPattern,
    difficulty: question.difficulty,
    expectedTimeMinutes: question.expectedTimeMinutes,
    problemStatement: question.problemStatement,
    promptSummary: question.promptSummary,
    constraints: [...question.constraints],
    examples: readExamples(question.examples),
    starterCode: question.starterCode ?? emptyStarterCode()
  };
}

function emptyStarterCode(): Record<"javascript" | "python" | "cpp" | "java", string> {
  return { javascript: "", python: "", cpp: "", java: "" };
}

function readExamples(
  value: unknown
): Array<{ input: string; output: string; explanation?: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((example) => {
    if (!example || typeof example !== "object") return [];
    const input = "input" in example && typeof example.input === "string" ? example.input : null;
    const output =
      "output" in example && typeof example.output === "string" ? example.output : null;
    if (!input || !output) return [];
    const explanation =
      "explanation" in example && typeof example.explanation === "string"
        ? example.explanation
        : undefined;
    return [{ input, output, ...(explanation ? { explanation } : {}) }];
  });
}

function asRole(value: string | null): Role {
  return value === "backend" ||
    value === "frontend" ||
    value === "fullstack" ||
    value === "data" ||
    value === "ai-ml" ||
    value === "pm"
    ? value
    : "fullstack";
}

function asLevel(value: string | null): Level {
  return value === "fresher" || value === "0-2" || value === "3-5" || value === "5-plus"
    ? value
    : "0-2";
}

async function lockOwner(tx: Prisma.TransactionClient, ownerId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`dsa-block-assessment:${ownerId}`}))`;
}

export function isPreparationError(error: unknown): error is DsaBlockAssessmentPreparationError {
  return error instanceof DsaBlockAssessmentPreparationError;
}
