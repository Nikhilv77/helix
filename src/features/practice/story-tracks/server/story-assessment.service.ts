import {
  AiMlPracticeTrack as DatabaseTrack,
  Prisma,
  StoryTrackAssessmentStatus
} from "@prisma/client";
import type { InterviewService } from "@/features/interviews/server/interview.service";
import type { PersistedAiMlPracticeTrack } from "@/features/practice/ai-ml/domain/ai-ml-practice";
import { storyPracticeInterviewResponses } from "@/features/practice/shared/server/assessment-transcript";
import { storyPracticeAssessmentIdentityFromSetup } from "@/features/practice/shared/server/contracts";
import { evaluateWrittenPracticeAnswer } from "@/features/practice/shared/server/written-answer-evaluator";
import {
  buildStoryAssessmentSnapshot,
  STORY_ASSESSMENT_MAX_ANSWER,
  STORY_ASSESSMENT_SCHEMA_VERSION,
  storyAssessmentReportSchema,
  storyAssessmentSnapshotSchema,
  type StoryAssessmentReport,
  type StoryAssessmentSnapshot,
  type StoryPathQuestionState
} from "@/features/practice/story-tracks/domain/story-assessment";
import {
  storyDisciplinePaths,
  type StoryDiscipline
} from "@/features/practice/story-tracks/domain/story-disciplines";
import type { AiService } from "@/server/ai/ai.service";
import { ConflictErrorException } from "@/server/common/exceptions/conflict-error.exception";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";
import type { PrismaService } from "@/server/database/prisma.service";
import { buildStoryAssessmentPlan, buildStoryAssessmentSetup } from "./story-assessment-runtime";

type Scope = { discipline: StoryDiscipline; track: PersistedAiMlPracticeTrack; pathKey: string };

/** A grading claim older than this is treated as abandoned and may be retried. */
const STALE_FINALIZING_MS = 3 * 60_000;

/** What the track overview shows about one path's assessment. */
export type StoryAssessmentSummary =
  | { status: "LOCKED"; remaining: number; total: number; allowEarlyStart: boolean }
  | { status: "READY" }
  | { status: "IN_PROGRESS" | "FINALIZING"; assessmentId: string }
  | { status: "COMPLETED"; assessmentId: string; report: StoryAssessmentReport };

/**
 * Assessments for finished Frontend, Data, and AI/ML story paths. They run in
 * the same typed interview room as the Node.js tracks (teacher, speech,
 * follow-ups); when the room finishes, its answers are graded here, one
 * evaluator call per prompt in parallel through the Gemini-then-Groq fallback.
 */
export class StoryAssessmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: Pick<AiService, "generateStructured">,
    private readonly interviews: Pick<InterviewService, "start">,
    private readonly options: { allowEarlyStart: boolean }
  ) {}

  async summary(ownerId: string, scope: Scope): Promise<StoryAssessmentSummary> {
    const path = this.path(scope);
    const [record, states] = await Promise.all([
      this.prisma.storyTrackAssessment.findUnique({
        where: { ownerId_discipline_track_pathKey: this.key(ownerId, scope) },
        select: { id: true, status: true, report: true }
      }),
      this.pathStates(
        ownerId,
        scope,
        path.questions.map((question) => question.id)
      )
    ]);
    if (record?.status === StoryTrackAssessmentStatus.COMPLETED && record.report) {
      return {
        status: "COMPLETED",
        assessmentId: record.id,
        report: storyAssessmentReportSchema.parse(record.report)
      };
    }
    if (record) {
      return { status: record.status as "IN_PROGRESS" | "FINALIZING", assessmentId: record.id };
    }
    const remaining = remainingQuestions(path.questions.length, states);
    if (remaining > 0) {
      return {
        status: "LOCKED",
        remaining,
        total: path.questions.length,
        allowEarlyStart: this.options.allowEarlyStart
      };
    }
    return { status: "READY" };
  }

  /**
   * Freezes the prompts once per path and starts (or resumes) its interview
   * room. The room's session id is the assessment id.
   */
  async startOrResume(ownerId: string, scope: Scope): Promise<{ sessionId: string }> {
    let record = await this.prisma.storyTrackAssessment.findUnique({
      where: { ownerId_discipline_track_pathKey: this.key(ownerId, scope) },
      select: { id: true, status: true, snapshot: true }
    });
    if (!record) record = await this.create(ownerId, scope);
    if (record.status !== StoryTrackAssessmentStatus.COMPLETED) {
      const snapshot = storyAssessmentSnapshotSchema.parse(record.snapshot);
      const owner = await this.prisma.candidateProfile.findUnique({
        where: { ownerId },
        select: { targetRole: true, level: true, context: true }
      });
      await this.interviews.start(
        buildStoryAssessmentSetup({
          assessmentId: record.id,
          scopeKey: scopeKey(scope),
          snapshot,
          owner: owner ?? { targetRole: null, level: null, context: null }
        }),
        ownerId,
        Date.now(),
        buildStoryAssessmentPlan(snapshot),
        record.id
      );
    }
    return { sessionId: record.id };
  }

  /**
   * Grades a finished room. Called after every final answer and on page
   * visits; only one caller claims the grading, and a stale claim is retried.
   */
  async finalizeInterviewOwned(ownerId: string, sessionId: string) {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
      select: { ownerId: true, state: true }
    });
    if (!session || session.ownerId !== ownerId) return null;
    const state = session.state as {
      phase?: string;
      setup?: Parameters<typeof storyPracticeAssessmentIdentityFromSetup>[0];
      turns?: Parameters<typeof storyPracticeInterviewResponses>[1];
    };
    const identity = storyPracticeAssessmentIdentityFromSetup(state.setup);
    if (identity?.practice !== "story-track" || state.phase !== "done") return null;

    const record = await this.prisma.storyTrackAssessment.findFirst({
      where: { id: identity.assessmentId, ownerId },
      select: { id: true, status: true, snapshot: true }
    });
    if (!record || record.status === StoryTrackAssessmentStatus.COMPLETED) return null;
    const snapshot = storyAssessmentSnapshotSchema.parse(record.snapshot);
    const responses = Object.fromEntries(
      storyPracticeInterviewResponses(
        snapshot.prompts,
        state.turns ?? [],
        STORY_ASSESSMENT_MAX_ANSWER
      ).map(({ promptId, answer }) => [promptId, answer])
    );

    const claimed = await this.prisma.storyTrackAssessment.updateMany({
      where: {
        id: record.id,
        ownerId,
        OR: [
          { status: StoryTrackAssessmentStatus.IN_PROGRESS },
          {
            status: StoryTrackAssessmentStatus.FINALIZING,
            updatedAt: { lt: new Date(Date.now() - STALE_FINALIZING_MS) }
          }
        ]
      },
      data: { status: StoryTrackAssessmentStatus.FINALIZING, responses: json(responses) }
    });
    if (claimed.count === 0) return null;

    try {
      const report = await this.grade(snapshot, responses);
      await this.prisma.storyTrackAssessment.updateMany({
        where: { id: record.id, ownerId, status: StoryTrackAssessmentStatus.FINALIZING },
        data: {
          status: StoryTrackAssessmentStatus.COMPLETED,
          report: json(report),
          completedAt: new Date()
        }
      });
      return report;
    } catch (error) {
      // Release the claim so the next page visit retries immediately.
      await this.prisma.storyTrackAssessment.updateMany({
        where: { id: record.id, ownerId, status: StoryTrackAssessmentStatus.FINALIZING },
        data: { status: StoryTrackAssessmentStatus.IN_PROGRESS }
      });
      throw error;
    }
  }

  /** The owner's assessment behind a room session, for the room page. */
  async roomScope(ownerId: string, sessionId: string) {
    const record = await this.prisma.storyTrackAssessment.findFirst({
      where: { id: sessionId, ownerId },
      select: { discipline: true, track: true, pathKey: true, status: true }
    });
    if (!record) return null;
    return {
      discipline: record.discipline as StoryDiscipline,
      track:
        record.track === DatabaseTrack.CORE_TECHNICAL
          ? ("core-technical" as const)
          : ("applied-engineering" as const),
      pathKey: record.pathKey,
      status: record.status
    };
  }

  /** Agent-capability path used after the final answer. */
  async finalizeInterviewBySession(sessionId: string) {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
      select: { ownerId: true }
    });
    return session ? this.finalizeInterviewOwned(session.ownerId, sessionId) : null;
  }

  private async create(ownerId: string, scope: Scope) {
    const path = this.path(scope);
    const states = await this.pathStates(
      ownerId,
      scope,
      path.questions.map((question) => question.id)
    );
    if (remainingQuestions(path.questions.length, states) > 0 && !this.options.allowEarlyStart) {
      throw new ConflictErrorException(
        "STORY_ASSESSMENT_LOCKED",
        "Finish every question in this path to unlock its assessment."
      );
    }
    const snapshot = buildStoryAssessmentSnapshot(path, states);
    const select = { id: true, status: true, snapshot: true } as const;
    try {
      return await this.prisma.storyTrackAssessment.create({
        data: {
          ...this.key(ownerId, scope),
          schemaVersion: STORY_ASSESSMENT_SCHEMA_VERSION,
          snapshot: json(snapshot)
        },
        select
      });
    } catch (error) {
      // A concurrent start already created it; use that one.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return this.prisma.storyTrackAssessment.findUniqueOrThrow({
          where: { ownerId_discipline_track_pathKey: this.key(ownerId, scope) },
          select
        });
      }
      throw error;
    }
  }

  private async grade(
    snapshot: StoryAssessmentSnapshot,
    responses: Record<string, string>
  ): Promise<StoryAssessmentReport> {
    const graded = await Promise.all(
      snapshot.prompts.map(async (prompt) => {
        const answer = responses[prompt.id]?.trim() ?? "";
        if (answer && prompt.choices?.length && prompt.correctIndex !== undefined) {
          // Multiple choice is graded by the chosen option, without a model call.
          const correct = prompt.choices[prompt.correctIndex]!;
          const right = answer === correct.trim();
          return {
            promptId: prompt.id,
            label: prompt.label,
            score: right ? 100 : 0,
            result: right ? "Correct." : `Not quite. The answer is: ${correct}`,
            didWell: right ? "You chose the right option." : "You committed to an answer.",
            missingOrIncorrect: right ? "Nothing to fix here." : prompt.reference.explanation,
            mechanism: prompt.reference.concise
          };
        }
        if (!answer) {
          return {
            promptId: prompt.id,
            label: prompt.label,
            score: 0,
            result: "You did not answer this question.",
            didWell: "Nothing to assess yet.",
            missingOrIncorrect: "This question was left blank.",
            mechanism: prompt.reference.concise
          };
        }
        const feedback = await evaluateWrittenPracticeAnswer(
          this.ai,
          {
            format: "written",
            prompt: prompt.prompt,
            artifact: prompt.artifact,
            answer: prompt.reference,
            rubric: prompt.rubric,
            commonMistakes: prompt.commonMistakes,
            interviewerFollowUps: prompt.interviewerFollowUps,
            interviewConnection: prompt.interviewConnection
          },
          answer,
          "practice.story_assessment.grade"
        );
        return {
          promptId: prompt.id,
          label: prompt.label,
          score: Math.round(feedback.score * 10),
          result: feedback.result,
          didWell: feedback.didWell,
          missingOrIncorrect: feedback.missingOrIncorrect,
          mechanism: feedback.mechanism
        };
      })
    );
    return storyAssessmentReportSchema.parse({
      overallScore: Math.round(
        graded.reduce((total, prompt) => total + prompt.score, 0) / graded.length
      ),
      prompts: graded,
      gradedAt: new Date().toISOString()
    });
  }

  private path(scope: Scope) {
    // Authored paths and the quick check; a personal resume path has none.
    const path = storyDisciplinePaths(scope.discipline, scope.track).find(
      (candidate) => candidate.key === scope.pathKey
    );
    if (!path) {
      throw new NotFoundErrorException(
        "STORY_ASSESSMENT_PATH_NOT_FOUND",
        "This practice path has no assessment."
      );
    }
    return path;
  }

  private async pathStates(
    ownerId: string,
    scope: Scope,
    questionKeys: string[]
  ): Promise<StoryPathQuestionState[]> {
    const rows = await this.prisma.aiMlPracticeQuestion.findMany({
      where: {
        ownerId,
        questionKey: { in: questionKeys },
        session: { discipline: scope.discipline, track: databaseTrack(scope.track) }
      },
      select: {
        questionKey: true,
        status: true,
        attempt: { select: { correct: true, evaluationSnapshot: true } }
      }
    });
    return rows.map((row) => ({
      questionKey: row.questionKey,
      status: row.status,
      score: attemptScore(row.attempt)
    }));
  }

  private key(ownerId: string, scope: Scope) {
    return {
      ownerId,
      discipline: scope.discipline,
      track: databaseTrack(scope.track),
      pathKey: scope.pathKey
    };
  }
}

function scopeKey(scope: Scope): string {
  return `${scope.discipline}:${scope.track}:${scope.pathKey}`;
}

function remainingQuestions(total: number, states: readonly StoryPathQuestionState[]): number {
  const finished = states.filter((state) => state.status !== "ACTIVE").length;
  return Math.max(0, total - finished);
}

function attemptScore(
  attempt: { correct: boolean | null; evaluationSnapshot: Prisma.JsonValue } | null
): number | null {
  if (!attempt) return null;
  if (attempt.correct !== null) return attempt.correct ? 10 : 0;
  const snapshot = attempt.evaluationSnapshot as { feedback?: { score?: unknown } } | null;
  const score = snapshot?.feedback?.score;
  return typeof score === "number" ? score : null;
}

function databaseTrack(track: PersistedAiMlPracticeTrack): DatabaseTrack {
  return track === "core-technical"
    ? DatabaseTrack.CORE_TECHNICAL
    : DatabaseTrack.APPLIED_ENGINEERING;
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
