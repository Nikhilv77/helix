import { DsaPracticeBlockStatus } from "@prisma/client";
import { z } from "zod";
import {
  parseDsaBlockAssessmentSnapshot,
  type DsaBlockAssessmentSnapshot
} from "@/lib/dsa/block-assessment";
import {
  parseDsaBlockAssessmentReport,
  type DsaBlockAssessmentReport
} from "@/lib/dsa/block-assessment-report";
import type { PlanQuestion } from "@/lib/roadmap/frontend-plan";
import type { PrismaService } from "@/server/database/prisma.service";
import { DsaPracticeBlockStore, type DsaPracticeBlockRecord } from "./dsa-practice-block.store";

const questionSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
  primaryPattern: z.string().min(1),
  expectedTimeMinutes: z.number().int().nonnegative(),
  phaseSlug: z.string().min(1),
  phaseNumber: z.number().int().nonnegative(),
  recommendedOrder: z.number().int().nonnegative()
});

const recommendationSchema = z.object({
  tier: z.enum(["foundations", "building", "advanced", "diagnostic"]),
  source: z.enum(["assessment", "performance"]),
  targetLabel: z.string(),
  focusChapterId: z.string(),
  focusLabel: z.string(),
  strengthLabel: z.string().nullable(),
  blockTitle: z.string(),
  rationale: z.string(),
  questions: z.array(questionSchema).min(1).max(12),
  minutes: z.number().int().nonnegative(),
  mix: z.object({
    easy: z.number().int().nonnegative(),
    medium: z.number().int().nonnegative(),
    hard: z.number().int().nonnegative()
  }),
  estimatedPathQuestions: z.number().int().nonnegative(),
  availableQuestions: z.number().int().nonnegative()
});

export type DsaBlockQuestionStatus = "COMPLETED" | "SKIPPED" | "IN_PROGRESS" | "NOT_STARTED";

export interface DsaBlockQuestionView extends PlanQuestion {
  status: DsaBlockQuestionStatus;
}

export interface DsaBlockRecommendationView {
  tier: "foundations" | "building" | "advanced" | "diagnostic";
  source: "assessment" | "performance";
  targetLabel: string;
  focusChapterId: string;
  focusLabel: string;
  strengthLabel: string | null;
  blockTitle: string;
  rationale: string;
  questions: DsaBlockQuestionView[];
  minutes: number;
  mix: { easy: number; medium: number; hard: number };
  estimatedPathQuestions: number;
  availableQuestions: number;
  legacy: boolean;
}

export interface DsaBlockPublicAssessmentPrompt {
  kind: "code-review" | "transfer";
  title: string;
  sourceQuestionTitle: string | null;
  codeSnippet: string | null;
  options: string[] | null;
}

export interface DsaBlockTranscriptTurn {
  speaker: "agent" | "user";
  text: string;
  startMs: number;
  endMs: number;
}

export interface DsaBlockAssessmentReportView {
  completedAt: string;
  durationMs: number;
  completion: { answered: number; skipped: number; total: number; partial: boolean };
  metrics: DsaBlockAssessmentReport["metrics"];
  overall: number;
  strengths: string[];
  gaps: string[];
  teacherSummary: string;
}

export interface DsaBlockHistoryItem {
  id: string;
  ordinal: number;
  current: boolean;
  status: DsaPracticeBlockStatus;
  flags: {
    practising: boolean;
    assessmentReady: boolean;
    assessmentInProgress: boolean;
    assessed: boolean;
  };
  dates: {
    createdAt: string;
    assessmentReadyAt: string | null;
    assessmentStartedAt: string | null;
    assessedAt: string | null;
  };
  recommendation: DsaBlockRecommendationView;
  completedQuestions: number;
  totalQuestions: number;
  assessment: {
    sessionId: string | null;
    report: DsaBlockAssessmentReportView | null;
    prompts: DsaBlockPublicAssessmentPrompt[];
  } | null;
  transcript: DsaBlockTranscriptTurn[] | null;
}

export interface DsaBlockHistoryView {
  selected: DsaBlockHistoryItem;
  previousBlockId: string | null;
  nextBlockId: string | null;
  totalBlocks: number;
}

export class DsaBlockHistoryError extends Error {
  constructor(
    readonly code: "BLOCK_NOT_FOUND" | "SNAPSHOT_INVALID",
    message: string
  ) {
    super(message);
    this.name = "DsaBlockHistoryError";
  }
}

/** Builds the only block-history shape that may cross the server/browser boundary. */
export class DsaBlockHistoryService {
  constructor(
    private readonly store: DsaPracticeBlockStore,
    private readonly prisma: PrismaService
  ) {}

  async read(
    ownerId: string,
    requestedBlockId: string | null,
    currentStatuses: Record<string, string>
  ): Promise<DsaBlockHistoryView | null> {
    const blocks = await this.store.history(ownerId);
    if (!blocks.length) return null;

    const selectedIndex = requestedBlockId
      ? blocks.findIndex((block) => block.id === requestedBlockId)
      : Math.max(
          blocks.findIndex((block) => block.isCurrent),
          0
        );
    if (selectedIndex < 0) {
      throw new DsaBlockHistoryError(
        "BLOCK_NOT_FOUND",
        "That DSA practice block does not belong to this candidate."
      );
    }

    const sessionIds = blocks.flatMap((block) =>
      block.assessment?.interviewSessionId ? [block.assessment.interviewSessionId] : []
    );
    const sessions = sessionIds.length
      ? await this.prisma.interviewSession.findMany({
          where: { ownerId, id: { in: sessionIds } },
          select: { id: true, state: true }
        })
      : [];
    const transcriptBySession = new Map(
      sessions.map((session) => [session.id, sanitizeTranscript(session.state)])
    );
    const items = blocks.map((block) => this.present(block, currentStatuses, transcriptBySession));

    return {
      selected: items[selectedIndex]!,
      // Store history is newest first: previous goes to the older block and
      // next returns toward the current/newer block.
      previousBlockId: items[selectedIndex + 1]?.id ?? null,
      nextBlockId: items[selectedIndex - 1]?.id ?? null,
      totalBlocks: items.length
    };
  }

  private present(
    block: DsaPracticeBlockRecord,
    currentStatuses: Record<string, string>,
    transcriptBySession: Map<string, DsaBlockTranscriptTurn[] | null>
  ): DsaBlockHistoryItem {
    const recommendation = readRecommendation(block, currentStatuses);
    const snapshot = readAssessmentSnapshot(block);
    const report = readReport(block);
    const sessionId = block.assessment?.interviewSessionId ?? null;

    return {
      id: block.id,
      ordinal: block.ordinal,
      current: block.isCurrent,
      status: block.status,
      flags: {
        practising: block.status === DsaPracticeBlockStatus.PRACTISING,
        assessmentReady: block.status === DsaPracticeBlockStatus.ASSESSMENT_READY,
        assessmentInProgress: block.status === DsaPracticeBlockStatus.ASSESSMENT_IN_PROGRESS,
        assessed: block.status === DsaPracticeBlockStatus.ASSESSED
      },
      dates: {
        createdAt: block.createdAt.toISOString(),
        assessmentReadyAt: block.assessmentReadyAt?.toISOString() ?? null,
        assessmentStartedAt: block.assessment?.startedAt?.toISOString() ?? null,
        assessedAt:
          block.assessedAt?.toISOString() ?? block.assessment?.completedAt?.toISOString() ?? null
      },
      recommendation,
      completedQuestions: recommendation.questions.filter(
        (question) => question.status === "COMPLETED"
      ).length,
      totalQuestions: recommendation.questions.length,
      assessment: block.assessment
        ? {
            sessionId,
            report,
            prompts: snapshot ? publicPrompts(snapshot) : []
          }
        : null,
      transcript: sessionId ? (transcriptBySession.get(sessionId) ?? null) : null
    };
  }
}

function readRecommendation(
  block: DsaPracticeBlockRecord,
  currentStatuses: Record<string, string>
): DsaBlockRecommendationView {
  const value = block.recommendationSnapshot;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalidSnapshot("The saved block recommendation is invalid.");
  }
  const version = "schemaVersion" in value ? value.schemaVersion : undefined;
  const frozenComplete = block.status !== DsaPracticeBlockStatus.PRACTISING;
  const statusFor = (slug: string) =>
    frozenComplete ? "COMPLETED" : normalizeQuestionStatus(currentStatuses[slug]);

  if (version === 0) {
    const slugs = Array.isArray(value.questionSlugs)
      ? value.questionSlugs.filter(
          (slug): slug is string => typeof slug === "string" && slug.length > 0
        )
      : block.questionSlugs;
    const questions = [...new Set(slugs)].map((slug, index) => ({
      slug,
      title: readableSlug(slug),
      difficulty: "medium" as const,
      primaryPattern: "saved-practice",
      expectedTimeMinutes: 0,
      phaseSlug: "legacy",
      phaseNumber: 0,
      recommendedOrder: index + 1,
      status: statusFor(slug)
    }));
    if (!questions.length) throw invalidSnapshot("The legacy block has no saved question cohort.");
    return {
      tier: "diagnostic",
      source: "assessment",
      targetLabel: "Saved DSA practice",
      focusChapterId: "legacy",
      focusLabel: "Saved practice block",
      strengthLabel: null,
      blockTitle: "Saved practice block",
      rationale: "This block was saved before detailed recommendation history was available.",
      questions,
      minutes: 0,
      mix: { easy: 0, medium: questions.length, hard: 0 },
      estimatedPathQuestions: questions.length,
      availableQuestions: questions.length,
      legacy: true
    };
  }

  if (version !== 1)
    throw invalidSnapshot("The saved block recommendation version is unsupported.");
  const parsed = recommendationSchema.safeParse(value.recommendation);
  if (!parsed.success) throw invalidSnapshot("The saved block recommendation is invalid.");
  if (
    parsed.data.questions.length !== block.questionSlugs.length ||
    parsed.data.questions.some((question, index) => question.slug !== block.questionSlugs[index])
  ) {
    throw invalidSnapshot("The saved recommendation does not match its frozen question cohort.");
  }
  return {
    ...parsed.data,
    questions: parsed.data.questions.map((question) => ({
      ...question,
      status: statusFor(question.slug)
    })),
    legacy: false
  };
}

function readAssessmentSnapshot(block: DsaPracticeBlockRecord): DsaBlockAssessmentSnapshot | null {
  const value = block.assessment?.assessmentSnapshot;
  if (!value) return null;
  try {
    const snapshot = parseDsaBlockAssessmentSnapshot(value);
    if (snapshot.blockId !== block.id || snapshot.blockOrdinal !== block.ordinal) throw new Error();
    return snapshot;
  } catch {
    throw invalidSnapshot("The saved block assessment is invalid.");
  }
}

function readReport(block: DsaPracticeBlockRecord): DsaBlockAssessmentReportView | null {
  const value = block.assessment?.reportSnapshot;
  if (!value) return null;
  try {
    const report = parseDsaBlockAssessmentReport(value);
    if (report.blockId !== block.id || report.sessionId !== block.assessment?.interviewSessionId) {
      throw new Error();
    }
    return {
      completedAt: report.completedAt,
      durationMs: report.durationMs,
      completion: { ...report.completion },
      metrics: { ...report.metrics },
      overall: report.overall,
      strengths: [...report.strengths],
      gaps: [...report.gaps],
      teacherSummary: report.teacherSummary
    };
  } catch {
    throw invalidSnapshot("The saved block assessment report is invalid.");
  }
}

function publicPrompts(snapshot: DsaBlockAssessmentSnapshot): DsaBlockPublicAssessmentPrompt[] {
  return [
    ...snapshot.reviewItems.map((item) => ({
      kind: "code-review" as const,
      title: item.prompt,
      sourceQuestionTitle: item.sourceQuestionTitle,
      codeSnippet: item.codeSnippet,
      options: [...item.options]
    })),
    ...snapshot.transferQuestions.map((item) => ({
      kind: "transfer" as const,
      title: item.title,
      sourceQuestionTitle: null,
      codeSnippet: null,
      options: null
    }))
  ];
}

function sanitizeTranscript(value: unknown): DsaBlockTranscriptTurn[] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const turns = "turns" in value ? value.turns : undefined;
  if (!Array.isArray(turns)) return null;
  const safe = turns.flatMap((turn): DsaBlockTranscriptTurn[] => {
    if (!turn || typeof turn !== "object" || Array.isArray(turn)) return [];
    const speaker = "speaker" in turn ? turn.speaker : undefined;
    const text = "text" in turn ? turn.text : undefined;
    if ((speaker !== "agent" && speaker !== "user") || typeof text !== "string") return [];
    const trimmed = text.trim().slice(0, 8_000);
    if (!trimmed) return [];
    const startMs = safeTimestamp("startMs" in turn ? turn.startMs : 0);
    const endMs = Math.max(startMs, safeTimestamp("endMs" in turn ? turn.endMs : startMs));
    return [{ speaker, text: trimmed, startMs, endMs }];
  });
  return safe.length ? safe : null;
}

function normalizeQuestionStatus(value: string | undefined): DsaBlockQuestionStatus {
  if (value === "COMPLETED" || value === "SKIPPED" || value === "IN_PROGRESS") return value;
  return "NOT_STARTED";
}

function safeTimestamp(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.min(Math.round(value), 24 * 60 * 60 * 1_000)
    : 0;
}

function readableSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function invalidSnapshot(message: string): DsaBlockHistoryError {
  return new DsaBlockHistoryError("SNAPSHOT_INVALID", message);
}
