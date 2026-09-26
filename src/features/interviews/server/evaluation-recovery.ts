import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { PrismaService } from "@/server/database/prisma.service";
import { Logger } from "@/server/common/logger";
import { createInterviewReportSnapshot } from "./report";
import type {
  TechnicalAnswerEvaluationInput,
  TechnicalAnswerEvaluator
} from "./technical-answer-evaluator";
import type { InterviewState, QuestionEvaluation } from "./types";

const PENDING = "PENDING";
const PROCESSING = "PROCESSING";
const COMPLETED = "COMPLETED";
const SUPERSEDED = "SUPERSEDED";
const DEAD_LETTER = "DEAD_LETTER";
const LEASE_MS = 60_000;
const RECOVERY_ATTEMPT_TIMEOUT_MS = 12_000;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000] as const;

export interface EvaluationRecoveryPayload extends Omit<TechnicalAnswerEvaluationInput, "signal"> {
  sessionId: string;
  questionIndex: number;
  answerHash: string;
  queuedAt: number;
}

export type EvaluationRecoveryMutation =
  | { action: "enqueue"; payload: EvaluationRecoveryPayload }
  | { action: "resolve"; questionIndex: number };

export interface ClaimedEvaluationJob {
  id: string;
  attempts: number;
  maxAttempts: number;
  payload: EvaluationRecoveryPayload;
}

export interface EvaluationRecoveryRepository {
  claim(limit?: number, now?: number, sessionId?: string): Promise<ClaimedEvaluationJob[]>;
  apply(
    job: ClaimedEvaluationJob,
    evaluation: QuestionEvaluation,
    now?: number
  ): Promise<"applied" | "superseded">;
  fail(job: ClaimedEvaluationJob, error: unknown, now?: number): Promise<"retry" | "dead-letter">;
}

export class InterviewEvaluationRecoveryService {
  private readonly logger = new Logger(InterviewEvaluationRecoveryService.name);

  constructor(
    private readonly repository: EvaluationRecoveryRepository,
    private readonly evaluator: TechnicalAnswerEvaluator
  ) {}

  /**
   * Grades queued answers. With `sessionId`, only that interview's jobs are
   * taken, so a finished assessment can be graded before its report is written.
   */
  async runBatch(
    limit = 5,
    now = Date.now(),
    options: { sessionId?: string } = {}
  ): Promise<{
    claimed: number;
    recovered: number;
    superseded: number;
    retried: number;
    deadLettered: number;
  }> {
    const jobs = await this.repository.claim(
      Math.max(1, Math.min(limit, 20)),
      now,
      options.sessionId
    );
    const result = {
      claimed: jobs.length,
      recovered: 0,
      superseded: 0,
      retried: 0,
      deadLettered: 0
    };

    for (const job of jobs) {
      try {
        const evaluation = await withRecoveryDeadline((signal) =>
          this.evaluator.evaluate({
            ...job.payload,
            evaluatedAt: Date.now(),
            signal
          })
        );
        const outcome = await this.repository.apply(
          job,
          {
            ...evaluation,
            runtime: evaluation.runtime ? { ...evaluation.runtime, recovered: true } : undefined
          },
          Date.now()
        );
        if (outcome === "applied") result.recovered += 1;
        else result.superseded += 1;
      } catch (error) {
        const outcome = await this.repository.fail(job, error, Date.now());
        if (outcome === "retry") result.retried += 1;
        else result.deadLettered += 1;
      }
    }

    this.logger.log(JSON.stringify({ event: "interview.evaluation-recovery.batch", ...result }));
    return result;
  }
}

export class PrismaEvaluationRecoveryRepository implements EvaluationRecoveryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async claim(limit = 5, now = Date.now(), sessionId?: string): Promise<ClaimedEvaluationJob[]> {
    const available = await this.prisma.interviewEvaluationJob.findMany({
      where: {
        ...(sessionId ? { sessionId } : {}),
        OR: [
          { status: PENDING, availableAt: { lte: new Date(now) } },
          { status: PROCESSING, leaseUntil: { lte: new Date(now) } }
        ]
      },
      orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
      take: Math.max(1, Math.min(limit, 20))
    });
    const claimed: ClaimedEvaluationJob[] = [];

    for (const candidate of available) {
      const updated = await this.prisma.interviewEvaluationJob.updateMany({
        where: {
          id: candidate.id,
          OR: [
            { status: PENDING, availableAt: { lte: new Date(now) } },
            { status: PROCESSING, leaseUntil: { lte: new Date(now) } }
          ]
        },
        data: {
          status: PROCESSING,
          attempts: { increment: 1 },
          leaseUntil: new Date(now + LEASE_MS)
        }
      });
      if (updated.count !== 1) continue;
      claimed.push({
        id: candidate.id,
        attempts: candidate.attempts + 1,
        maxAttempts: candidate.maxAttempts,
        payload: candidate.payload as unknown as EvaluationRecoveryPayload
      });
    }
    return claimed;
  }

  async apply(
    job: ClaimedEvaluationJob,
    evaluation: QuestionEvaluation,
    now = Date.now()
  ): Promise<"applied" | "superseded"> {
    return this.prisma.$transaction(async (transaction) => {
      const row = await transaction.interviewEvaluationJob.findUnique({ where: { id: job.id } });
      if (!row || row.status !== PROCESSING) return "superseded" as const;
      const session = await transaction.interviewSession.findUnique({
        where: { id: job.payload.sessionId }
      });
      if (!session) {
        await transaction.interviewEvaluationJob.update({
          where: { id: job.id },
          data: { status: SUPERSEDED, leaseUntil: null, completedAt: new Date(now) }
        });
        return "superseded" as const;
      }

      const state = session.state as unknown as InterviewState;
      const currentHash = evaluationAnswerHash(answerTexts(state, job.payload.questionIndex));
      if (currentHash !== job.payload.answerHash) {
        await transaction.interviewEvaluationJob.update({
          where: { id: job.id },
          data: { status: SUPERSEDED, leaseUntil: null, completedAt: new Date(now) }
        });
        return "superseded" as const;
      }

      const nextState: InterviewState = {
        ...state,
        questionEvaluations: {
          ...state.questionEvaluations,
          [String(job.payload.questionIndex)]: evaluation
        }
      };
      const touchedAt = session.touchedAt.getTime();
      const updated = await transaction.interviewSession.updateMany({
        where: { id: session.id, version: session.version },
        data: {
          state: json(nextState),
          reportSnapshot: json(
            createInterviewReportSnapshot({ state: nextState, touchedAt }, touchedAt)
          ),
          version: { increment: 1 },
          // Recovery must not revive an expired live room.
          touchedAt: session.touchedAt
        }
      });
      if (updated.count !== 1) throw new Error("Interview changed during evaluation recovery");

      await transaction.interviewEvaluationJob.update({
        where: { id: job.id },
        data: { status: COMPLETED, leaseUntil: null, completedAt: new Date(now), lastError: null }
      });
      return "applied" as const;
    });
  }

  async fail(
    job: ClaimedEvaluationJob,
    error: unknown,
    now = Date.now()
  ): Promise<"retry" | "dead-letter"> {
    const exhausted = job.attempts >= job.maxAttempts;
    const delay = RETRY_DELAYS_MS[Math.min(job.attempts - 1, RETRY_DELAYS_MS.length - 1)] ?? 60_000;
    await this.prisma.interviewEvaluationJob.updateMany({
      where: { id: job.id, status: PROCESSING },
      data: {
        status: exhausted ? DEAD_LETTER : PENDING,
        availableAt: new Date(now + delay),
        leaseUntil: null,
        lastError: safeError(error),
        completedAt: exhausted ? new Date(now) : null
      }
    });
    return exhausted ? "dead-letter" : "retry";
  }
}

export function evaluationAnswerHash(answers: string[]): string {
  return createHash("sha256")
    .update(JSON.stringify(answers.map((answer) => answer.replace(/\s+/g, " ").trim())))
    .digest("hex");
}

export function answerTexts(state: InterviewState, questionIndex: number): string[] {
  return state.turns
    .filter((turn) => turn.speaker === "user" && turn.questionIndex === questionIndex)
    .map((turn) => turn.text);
}

function safeError(error: unknown): string {
  const value =
    error instanceof Error ? `${error.name}: ${error.message}` : "Unknown evaluation error";
  return value.replace(/[\r\n]+/g, " ").slice(0, 500);
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function withRecoveryDeadline<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("Interview evaluation recovery timed out"));
        }, RECOVERY_ATTEMPT_TIMEOUT_MS);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
