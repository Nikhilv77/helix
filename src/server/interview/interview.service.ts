import { createHash, randomUUID } from "node:crypto";
import { Logger } from "../common/logger";
import { BadRequestErrorException } from "../common/exceptions/bad-request-error.exception";
import { ConflictErrorException } from "../common/exceptions/conflict-error.exception";
import { NotFoundErrorException } from "../common/exceptions/not-found-error.exception";
import { InterviewDecider, normaliseMissing } from "./decider";
import { InterviewPlanner } from "./planner";
import {
  SessionStore,
  SessionVersionConflictError,
  type BeginAnswerResult,
  type VersionedInterviewSession
} from "./session-store";
import {
  createHistoryItem,
  createInterviewReport,
  createWorkspaceInsightsFromReports
} from "./report";
import { createReportsOverview } from "./reports-overview";
import type { ReportsOverview } from "@/lib/reports/reports";
import type { InterviewHistoryItem, InterviewReport, WorkspaceInsights } from "@/lib/shared/types";
import {
  advance,
  appendTurn,
  beginQuestioning,
  createState,
  currentQuestion,
  elapsedMs,
  finish
} from "./state-machine";
import {
  CodeExecutionEvidence,
  Decision,
  DecisionAction,
  EvidenceDimension,
  EvidenceLedger,
  InterviewSetup,
  InterviewAnswerResponse,
  InterviewState,
  MissingDimension,
  PlannedQuestion,
  QuestionEvaluation,
  roundCaps
} from "./types";
import { isResumeRound } from "./prompt-context";
import { gradeMultipleChoice, multipleChoiceReply } from "./resume-round";
import {
  shouldEvaluateTechnicalAnswer,
  type TechnicalAnswerEvaluator
} from "./technical-answer-evaluator";

const DAY_MS = 24 * 60 * 60 * 1000;
/** A spoken conversation should never wait on the model's full provider timeout. */
const DECIDER_BUDGET_MS = 4_000;
const EVALUATOR_BUDGET_MS = 3_500;

export interface StartResult {
  state: InterviewState;
  utterance: string;
}

export interface AnswerResult {
  state: InterviewState;
  decision: Decision;
  response: InterviewAnswerResponse;
}

const ANSWER_REPLAY_WAIT_MS = 5_000;
const ANSWER_REPLAY_POLL_MS = 100;

export class InterviewService {
  private readonly logger = new Logger(InterviewService.name);

  constructor(
    private readonly planner: InterviewPlanner,
    private readonly decider: InterviewDecider,
    private readonly store: SessionStore,
    /** Configurable so local iteration is not throttled by the product cap. */
    private readonly dailyLimit = 2,
    private readonly answerEvaluator?: TechnicalAnswerEvaluator
  ) {}

  /**
   * `prebuiltPlan` is for rounds that are assembled from stored content rather
   * than planned by the model, which is what makes the resume round free to
   * start. Everything else still goes through the planner.
   */
  async start(
    setup: InterviewSetup,
    ownerId: string,
    now = Date.now(),
    prebuiltPlan?: PlannedQuestion[]
  ): Promise<StartResult> {
    const used = await this.store.countStartedSince(ownerId, now - DAY_MS);
    if (used >= this.dailyLimit) {
      throw new BadRequestErrorException("SESSION_LIMIT_REACHED", "Daily session limit reached", {
        limit: this.dailyLimit,
        used
      });
    }

    const plan = prebuiltPlan?.length ? prebuiltPlan : await this.planner.plan(setup);
    if (plan.length === 0) {
      throw new BadRequestErrorException("PLAN_EMPTY", "No questions could be planned", {});
    }

    const state = createState({ id: randomUUID(), setup, plan, startedAt: now });
    const utterance = introUtterance(state);
    const withIntro = appendTurn(beginQuestioning(state), {
      speaker: "agent",
      text: utterance,
      startMs: 0,
      endMs: 0,
      action: "intro",
      questionIndex: 0
    });

    await this.store.create(withIntro, ownerId);

    this.logger.log(
      JSON.stringify({
        event: "interview.started",
        sessionId: withIntro.id,
        role: setup.role,
        level: setup.level,
        roundType: setup.roundType,
        intensity: setup.intensity,
        questions: plan.length
      })
    );

    return { state: withIntro, utterance };
  }

  /** Backs the "sessions left today" indicator in the workspace sidebar. */
  async quota(ownerId: string, now = Date.now()): Promise<{ used: number; limit: number }> {
    return {
      used: Math.min(this.dailyLimit, await this.store.countStartedSince(ownerId, now - DAY_MS)),
      limit: this.dailyLimit
    };
  }

  async history(ownerId: string, limit = 20, now = Date.now()): Promise<InterviewHistoryItem[]> {
    const boundedLimit = Math.max(1, Math.min(limit, 50));
    const sessions = await this.store.listByOwner(ownerId, boundedLimit);
    return sessions.map((session) => createHistoryItem(session, now));
  }

  /** Claims sessions created by the same browser before Clerk auth was resolved. */
  async claimAnonymousHistory(anonymousOwnerId: string, ownerId: string): Promise<number> {
    if (!anonymousOwnerId.startsWith("anon:") || !ownerId.startsWith("user:")) return 0;
    return this.store.reassignOwner(anonymousOwnerId, ownerId);
  }

  async insights(ownerId: string, limit = 30, now = Date.now()): Promise<WorkspaceInsights> {
    const boundedLimit = Math.max(1, Math.min(limit, 50));
    return createWorkspaceInsightsFromReports(
      await this.store.listReportsByOwner(ownerId, boundedLimit, now),
      now
    );
  }

  /**
   * Every round this user has run, folded into the cross-round view. The store
   * supplies transcript-free report snapshots so the index does not have to
   * deserialize complete interview states.
   */
  async reportsOverview(ownerId: string, limit = 50, now = Date.now()): Promise<ReportsOverview> {
    const boundedLimit = Math.max(1, Math.min(limit, 50));
    return createReportsOverview(
      await this.store.listReportsByOwner(ownerId, boundedLimit, now),
      now
    );
  }

  async report(ownerId: string, sessionId: string, now = Date.now()): Promise<InterviewReport> {
    const session = await this.store.getOwned(sessionId, ownerId);
    if (!session) {
      throw new NotFoundErrorException("SESSION_NOT_FOUND", "Interview session not found", {
        sessionId
      });
    }

    return createInterviewReport(session, now);
  }

  /** Unowned lookup reserved for a route that already verified an agent capability. */
  async get(sessionId: string, ownerId?: string): Promise<InterviewState> {
    return (await this.versionedSession(sessionId, ownerId)).state;
  }

  private async versionedSession(
    sessionId: string,
    ownerId?: string
  ): Promise<VersionedInterviewSession> {
    const session = ownerId
      ? await this.store.getActiveOwnedVersioned(sessionId, ownerId)
      : await this.store.getVersioned(sessionId);
    if (!session) {
      throw new NotFoundErrorException("SESSION_NOT_FOUND", "Interview session not found", {
        sessionId
      });
    }
    return session;
  }

  async getOwnedActive(ownerId: string, sessionId: string): Promise<InterviewState> {
    return this.get(sessionId, ownerId);
  }

  /** Records execution separately from correctness so reports never equate compiling with passing. */
  async recordCodeExecution(
    ownerId: string,
    sessionId: string,
    questionIndex: number,
    execution: CodeExecutionEvidence
  ): Promise<InterviewState> {
    const session = await this.store.getActiveOwnedVersioned(sessionId, ownerId);
    if (!session) {
      throw new NotFoundErrorException("SESSION_NOT_FOUND", "Interview session not found", {
        sessionId
      });
    }
    const question = session.state.plan[questionIndex];
    if (!question || question.kind !== "code" || session.state.questionIndex !== questionIndex) {
      throw new BadRequestErrorException(
        "CODE_EXECUTION_QUESTION_MISMATCH",
        "The code result does not belong to the active interview question.",
        { sessionId, questionIndex }
      );
    }

    const next: InterviewState = {
      ...session.state,
      codeExecutions: {
        ...session.state.codeExecutions,
        [String(questionIndex)]: execution
      }
    };
    try {
      await this.store.save(next, session.version);
    } catch (error) {
      throw sessionMutationError(error, sessionId);
    }
    return next;
  }

  /**
   * The whole turn: record the answer, ask the model for an action, let the
   * guards override it, record what the agent says back.
   *
   * The Python agent in Phase 2 calls this through /api/interview/decide, so
   * the decision logic has exactly one home.
   */
  async answer(
    sessionId: string,
    answer: { text: string; startMs: number; endMs: number },
    now = Date.now(),
    turnId?: string
  ): Promise<AnswerResult> {
    return this.answerInternal(sessionId, answer, now, undefined, turnId);
  }

  async answerOwned(
    ownerId: string,
    sessionId: string,
    answer: { text: string; startMs: number; endMs: number },
    now = Date.now(),
    turnId?: string
  ): Promise<AnswerResult> {
    return this.answerInternal(sessionId, answer, now, ownerId, turnId);
  }

  private async answerInternal(
    sessionId: string,
    answer: { text: string; startMs: number; endMs: number },
    now: number,
    ownerId?: string,
    turnId?: string
  ): Promise<AnswerResult> {
    // Establish ownership/capability-backed access before creating an
    // idempotency row, so a guessed UUID cannot cause writes to another user.
    const session = await this.versionedSession(sessionId, ownerId);
    const answerHash = turnId ? answerPayloadHash(answer) : null;
    if (turnId && answerHash) {
      const claim = await this.store.beginAnswer(sessionId, turnId, answerHash, now);
      const replay = await this.resolveAnswerClaim(claim, sessionId, turnId, answerHash, ownerId);
      if (replay) return replay;
    }

    try {
      return await this.processAnswer(session, sessionId, answer, now, turnId);
    } catch (error) {
      if (turnId) {
        if (error instanceof SessionVersionConflictError) {
          const completed = await this.store.answerRequest(sessionId, turnId, answerHash!);
          if (completed.status === "completed") {
            return this.replayedAnswer(sessionId, completed.response, ownerId);
          }
          await this.store.conflictAnswer(sessionId, turnId);
          throw sessionMutationError(error, sessionId);
        }
        await this.store.failAnswer(sessionId, turnId);
      }
      throw sessionMutationError(error, sessionId);
    }
  }

  private async processAnswer(
    session: VersionedInterviewSession,
    sessionId: string,
    answer: { text: string; startMs: number; endMs: number },
    now: number,
    turnId?: string
  ): Promise<AnswerResult> {
    const existing = session.state;

    if (existing.phase === "done") {
      throw new BadRequestErrorException("SESSION_COMPLETE", "This interview has ended", {
        sessionId
      });
    }

    const question = currentQuestion(existing);
    if (!question) {
      const closed = finish(existing);
      const decision = closingDecision();
      const response = answerResponse(closed, decision, now);
      await this.persistAnswer(closed, session.version, turnId, response);
      return { state: closed, decision, response };
    }

    const withAnswer = appendTurn(existing, {
      speaker: "user",
      text: answer.text,
      startMs: answer.startMs,
      endMs: answer.endMs,
      questionIndex: existing.questionIndex
    });

    // A multiple choice answer is decided by comparison, not by the model. The
    // correct option and its explanation were written when the resume was read.
    const graded = gradeMultipleChoice(question, answer.text);
    if (graded) {
      return this.completeGradedAnswer(
        withAnswer,
        question,
        graded.correct,
        now,
        session.version,
        turnId
      );
    }

    const [raw, evaluation] = await Promise.all([
      this.decideWithFallback({
        setup: withAnswer.setup,
        questionAsked: question.text,
        evidenceAnchor: question.evidenceAnchor,
        competency: question.competency,
        intent: question.intent,
        questionKind: question.kind === "mcq" ? "code" : question.kind,
        language: question.language,
        codeTask: question.codeTask,
        codeSnippet: question.codeSnippet,
        mustHit: question.mustHit,
        userAnswer: answer.text,
        followUpCount: withAnswer.followUpCount,
        maxFollowUps: question.maxFollowUps,
        topicLabel: topicLabelFor(withAnswer.setup, question),
        blueprintDifficulty: question.blueprintDifficulty,
        rubric: rubricFor(withAnswer.setup, question),
        followUpPolicy: withAnswer.setup.personalizedBlueprint?.followUpPolicy,
        fallbackProbe: question.probeIfMissing,
        evidenceLedger: withAnswer.evidence?.[String(withAnswer.questionIndex)],
        conversationHistory: withAnswer.turns
          .slice(0, -1)
          .slice(-8)
          .map((turn) => ({ speaker: turn.speaker, text: turn.text.slice(0, 600) }))
      }),
      this.evaluateAnswer(withAnswer, question, now)
    ]);

    const result = advance(withAnswer, raw.action, now);
    const questionEvidence = recordEvidence(
      withAnswer.evidence?.[String(withAnswer.questionIndex)],
      answer.text,
      raw.missing,
      question,
      withAnswer.setup
    );
    const withEvidence: InterviewState = {
      ...result.state,
      evidence: {
        ...withAnswer.evidence,
        [String(withAnswer.questionIndex)]: questionEvidence
      },
      questionEvaluations: evaluation
        ? {
            ...result.state.questionEvaluations,
            [String(withAnswer.questionIndex)]: evaluation
          }
        : result.state.questionEvaluations
    };
    const acknowledgement = naturalAcknowledgement(
      raw.acknowledgement,
      result.action,
      withAnswer.turns,
      result.state.followUpCount
    );
    const utterance = this.composeUtterance(
      withEvidence,
      result.action,
      joinSpoken(acknowledgement, singleQuestion(stripGenericLead(raw.line?.trim() ?? "")))
    );

    const spokenAt = elapsedMs(result.state, now);
    const withReply = appendTurn(withEvidence, {
      speaker: "agent",
      text: utterance,
      startMs: spokenAt,
      endMs: spokenAt,
      action: result.action,
      forcedBy: result.forcedBy,
      questionIndex: result.state.questionIndex
    });

    const finalState = withReply;
    const decision: Decision = {
      action: result.action,
      missing: normaliseMissing(raw.missing),
      reason: raw.reason,
      utterance,
      forcedBy: result.forcedBy
    };
    const response = answerResponse(finalState, decision, now);
    await this.persistAnswer(finalState, session.version, turnId, response);

    this.logger.log(
      JSON.stringify({
        event: "interview.decision",
        sessionId,
        requested: raw.action,
        action: result.action,
        forcedBy: result.forcedBy,
        missing: decision.missing,
        questionIndex: finalState.questionIndex,
        followUpCount: finalState.followUpCount,
        elapsedMs: elapsedMs(finalState, now)
      })
    );

    return { state: finalState, decision, response };
  }

  /**
   * Finishes a turn that was scored without a model call. It always moves on:
   * a graded question has no missing evidence left to probe for.
   */
  private async completeGradedAnswer(
    state: InterviewState,
    question: PlannedQuestion,
    correct: boolean,
    now: number,
    expectedVersion: number,
    turnId?: string
  ): Promise<AnswerResult> {
    const evaluatedState: InterviewState = {
      ...state,
      questionEvaluations: {
        ...state.questionEvaluations,
        [String(state.questionIndex)]: multipleChoiceEvaluation(state, question, correct, now)
      }
    };
    const result = advance(evaluatedState, "move_on", now);
    const utterance = this.composeUtterance(
      result.state,
      result.action,
      multipleChoiceReply(question, correct)
    );
    const spokenAt = elapsedMs(result.state, now);
    const finalState = appendTurn(result.state, {
      speaker: "agent",
      text: utterance,
      startMs: spokenAt,
      endMs: spokenAt,
      action: result.action,
      forcedBy: result.forcedBy,
      questionIndex: result.state.questionIndex,
      correct,
      gradedQuestionIndex: state.questionIndex
    });

    const decision: Decision = {
      action: result.action,
      missing: correct ? "none" : "specificity",
      reason: correct
        ? "multiple choice answered correctly"
        : "multiple choice answered incorrectly",
      utterance,
      forcedBy: result.forcedBy
    };
    const response = answerResponse(finalState, decision, now);
    await this.persistAnswer(finalState, expectedVersion, turnId, response);

    this.logger.log(
      JSON.stringify({
        event: "interview.graded",
        sessionId: finalState.id,
        correct,
        questionIndex: finalState.questionIndex,
        elapsedMs: elapsedMs(finalState, now)
      })
    );

    return {
      state: finalState,
      decision,
      response
    };
  }

  async end(sessionId: string, ownerId?: string): Promise<InterviewState> {
    const session = await this.versionedSession(sessionId, ownerId);
    const closed = finish(session.state);
    try {
      await this.store.save(closed, session.version);
      return closed;
    } catch (error) {
      throw sessionMutationError(error, sessionId);
    }
  }

  async endOwned(ownerId: string, sessionId: string): Promise<InterviewState> {
    return this.end(sessionId, ownerId);
  }

  private async persistAnswer(
    state: InterviewState,
    expectedVersion: number,
    turnId: string | undefined,
    response: InterviewAnswerResponse
  ): Promise<void> {
    if (turnId) {
      await this.store.completeAnswer(state, expectedVersion, turnId, response);
      return;
    }
    await this.store.save(state, expectedVersion);
  }

  private async resolveAnswerClaim(
    claim: BeginAnswerResult,
    sessionId: string,
    turnId: string,
    answerHash: string,
    ownerId?: string
  ): Promise<AnswerResult | null> {
    if (claim.status === "claimed") return null;
    if (claim.status === "completed") {
      return this.replayedAnswer(sessionId, claim.response, ownerId);
    }
    if (claim.status === "payload-mismatch") {
      throw new ConflictErrorException(
        "TURN_ID_REUSED",
        "That turn ID was already used for a different answer.",
        { sessionId, turnId }
      );
    }
    if (claim.status === "conflicted") {
      throw concurrentTurnError(sessionId);
    }

    const deadline = Date.now() + ANSWER_REPLAY_WAIT_MS;
    while (Date.now() < deadline) {
      await delay(ANSWER_REPLAY_POLL_MS);
      const latest = await this.store.answerRequest(sessionId, turnId, answerHash);
      if (latest.status === "completed") {
        return this.replayedAnswer(sessionId, latest.response, ownerId);
      }
      if (latest.status === "payload-mismatch") {
        throw new ConflictErrorException(
          "TURN_ID_REUSED",
          "That turn ID was already used for a different answer.",
          { sessionId, turnId }
        );
      }
      if (latest.status === "conflicted") throw concurrentTurnError(sessionId);
    }

    throw new ConflictErrorException(
      "ANSWER_IN_PROGRESS",
      "That answer is still being processed. Retry with the same turn ID.",
      { sessionId, turnId, retryable: true }
    );
  }

  private async replayedAnswer(
    sessionId: string,
    response: InterviewAnswerResponse,
    ownerId?: string
  ): Promise<AnswerResult> {
    const state = await this.get(sessionId, ownerId);
    return {
      state,
      decision: {
        action: response.action,
        missing: response.missing,
        reason: "idempotent answer replay",
        utterance: response.utterance,
        forcedBy: response.forcedBy
      },
      response
    };
  }

  private async evaluateAnswer(
    state: InterviewState,
    question: PlannedQuestion,
    now: number
  ): Promise<QuestionEvaluation | null> {
    if (!shouldEvaluateTechnicalAnswer(state.setup, question)) {
      return null;
    }
    if (!this.answerEvaluator) return unavailableTechnicalEvaluation(state, question, now);

    const questionIndex = state.questionIndex;
    const answers = state.turns
      .filter((turn) => turn.speaker === "user" && turn.questionIndex === questionIndex)
      .map((turn) => turn.text);

    try {
      return await within(
        this.answerEvaluator.evaluate({
          setup: state.setup,
          question,
          answers,
          rubric: rubricFor(state.setup, question) ?? [],
          execution: state.codeExecutions?.[String(questionIndex)] ?? null,
          evaluatedAt: now
        }),
        EVALUATOR_BUDGET_MS,
        "Interview answer evaluator"
      );
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: "interview.answer-evaluation.fallback",
          sessionId: state.id,
          questionIndex,
          reason: error instanceof Error ? error.name : "unknown"
        })
      );
      return unavailableTechnicalEvaluation(state, question, now);
    }
  }

  /**
   * A failed decider call must not stall the interview. The planner already
   * wrote a grounded fallback probe for every question, so use it.
   */
  private async decideWithFallback(input: {
    setup: InterviewSetup;
    questionAsked: string;
    evidenceAnchor?: string;
    competency?: string;
    intent?: string;
    questionKind?: "conversation" | "code";
    language?: string;
    codeTask?: string;
    codeSnippet?: string;
    mustHit: string[];
    userAnswer: string;
    followUpCount: number;
    maxFollowUps?: number;
    topicLabel?: string;
    blueprintDifficulty?: PlannedQuestion["blueprintDifficulty"];
    rubric?: NonNullable<InterviewSetup["personalizedBlueprint"]>["rubric"];
    followUpPolicy?: NonNullable<InterviewSetup["personalizedBlueprint"]>["followUpPolicy"];
    fallbackProbe: string;
    conversationHistory: Array<{ speaker: "agent" | "user"; text: string }>;
    evidenceLedger?: EvidenceLedger;
  }) {
    try {
      return await within(this.decider.decide(input), DECIDER_BUDGET_MS, "Interview decider");
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: "interview.decide.fallback",
          reason: error instanceof Error ? error.name : "unknown"
        })
      );

      const shouldMove = input.followUpCount >= Math.min(1, input.maxFollowUps ?? 2);
      return {
        action: shouldMove ? ("move_on" as const) : ("probe" as const),
        missing: "specificity",
        reason: "decider unavailable; used planned fallback",
        acknowledgement: shouldMove
          ? ["That helps", "Right, I see the thread", "That gives me a clearer picture"][
              input.followUpCount % 3
            ]
          : "",
        line: shouldMove ? "" : input.fallbackProbe
      };
    }
  }

  /** move_on speaks the planned question verbatim after the model's bridge. */
  private composeUtterance(
    state: InterviewState,
    action: Decision["action"],
    line: string
  ): string {
    const acknowledgement = line.trim();

    if (action !== "move_on") {
      return acknowledgement.length > 0
        ? acknowledgement
        : "Could you walk me through that once more?";
    }

    if (state.phase === "done" || state.phase === "wrap") {
      return joinSpoken(
        acknowledgement,
        "That covers everything I wanted to explore. Thanks for the conversation. Your feedback will be ready shortly."
      );
    }

    const next = currentQuestion(state);
    if (!next) {
      return joinSpoken(
        acknowledgement,
        "That covers everything I wanted to explore. Thanks for the conversation."
      );
    }

    return joinSpoken(acknowledgement, next.text);
  }
}

async function within<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function multipleChoiceEvaluation(
  state: InterviewState,
  question: PlannedQuestion,
  correct: boolean,
  evaluatedAt: number
): QuestionEvaluation {
  const answer = state.turns
    .filter((turn) => turn.speaker === "user" && turn.questionIndex === state.questionIndex)
    .at(-1)?.text;
  const rubricKey = question.rubricKeys?.[0] ?? question.competency ?? "technical-correctness";

  return {
    source: "local-mcq",
    score: correct ? 100 : 0,
    verdict: correct ? "correct" : "incorrect",
    confidence: 1,
    summary: correct
      ? "The selected answer matches the authored correct option."
      : "The selected answer does not match the authored correct option.",
    strengths: correct ? ["Selected the technically correct option."] : [],
    gaps: correct ? [] : ["Review the underlying concept and the authored correct option."],
    rubricScores: [
      {
        rubricKey,
        score: correct ? 100 : 0,
        rationale: correct
          ? "Matched the authored answer key."
          : "Did not match the authored answer key."
      }
    ],
    answerExcerpts: answer ? [answer.replace(/\s+/g, " ").trim().slice(0, 240)] : [],
    execution: null,
    evaluatedAt
  };
}

function unavailableTechnicalEvaluation(
  state: InterviewState,
  question: PlannedQuestion,
  evaluatedAt: number
): QuestionEvaluation {
  const answers = state.turns
    .filter((turn) => turn.speaker === "user" && turn.questionIndex === state.questionIndex)
    .map((turn) => turn.text.replace(/\s+/g, " ").trim().slice(0, 240))
    .filter(Boolean)
    .slice(-3);

  return {
    source: "evaluation-unavailable",
    score: 0,
    verdict: "insufficient-evidence",
    confidence: 0,
    summary: "Technical correctness could not be verified for this answer.",
    strengths: [],
    gaps: ["Retry evaluation before using this answer as a performance signal."],
    rubricScores: (question.rubricKeys ?? []).map((rubricKey) => ({
      rubricKey,
      score: 0,
      rationale: "Not scored because the correctness evaluator was unavailable."
    })),
    answerExcerpts: answers,
    execution: state.codeExecutions?.[String(state.questionIndex)] ?? null,
    evaluatedAt
  };
}

function joinSpoken(bridge: string, sentence: string): string {
  if (bridge.length === 0) return sentence;
  return /[.!?]$/.test(bridge) ? `${bridge} ${sentence}` : `${bridge}. ${sentence}`;
}

const NATURAL_BRIDGES: Record<DecisionAction, string[]> = {
  clarify: ["Let me rephrase that.", "I want to make sure I’m following."],
  probe: [
    "That gives me a useful thread.",
    "I want to stay with that part.",
    "Let’s unpack that a little.",
    "That’s the part I want to understand better."
  ],
  challenge: [
    "Let me pressure-test that decision.",
    "I want to check one thing there.",
    "That raises one question for me."
  ],
  move_on: [
    "That gives me a clear picture.",
    "I can place that now.",
    "That’s enough context for me."
  ]
};

const GENERIC_ACKNOWLEDGEMENT =
  /^(?:got it|gotcha|understood|i understand|makes sense|okay|ok|right|great|excellent|good answer|thanks for sharing)(?:[.!?,\s]|$)/i;

function stripGenericLead(text: string): string {
  return text
    .replace(
      /^(?:got it|gotcha|understood|i understand|makes sense|okay|ok|right|great|excellent|good answer|thanks for sharing)(?:[.!?,\s]+)+/i,
      ""
    )
    .trim();
}

function singleQuestion(text: string): string {
  const firstQuestionEnd = text.indexOf("?");
  return firstQuestionEnd >= 0 ? text.slice(0, firstQuestionEnd + 1).trim() : text;
}

function naturalAcknowledgement(
  acknowledgement: string | undefined,
  action: DecisionAction,
  turns: InterviewState["turns"],
  sequence: number
): string {
  const candidate = acknowledgement?.trim() ?? "";
  if (candidate && !GENERIC_ACKNOWLEDGEMENT.test(candidate) && !recentlyUsed(candidate, turns)) {
    return candidate;
  }

  if (!candidate) return "";

  const options = NATURAL_BRIDGES[action];
  for (let offset = 0; offset < options.length; offset += 1) {
    const option = options[(sequence + offset) % options.length];
    if (option && !recentlyUsed(option, turns)) return option;
  }

  return "";
}

function recentlyUsed(acknowledgement: string, turns: InterviewState["turns"]): boolean {
  const normalized = acknowledgement
    .replace(/[.!?]+$/, "")
    .trim()
    .toLowerCase();
  return turns
    .filter((turn) => turn.speaker === "agent")
    .slice(-4)
    .some((turn) => turn.text.split(/[.!?]/, 1)[0]?.trim().toLowerCase() === normalized);
}

function recordEvidence(
  current: EvidenceLedger | undefined,
  answer: string,
  missing: string,
  question: PlannedQuestion,
  setup: InterviewSetup
): EvidenceLedger {
  const ledger: EvidenceLedger = current
    ? {
        ownership: [...current.ownership],
        decision: [...current.decision],
        specificity: [...current.specificity],
        outcome: [...current.outcome],
        gaps: [...current.gaps],
        blueprint: current.blueprint
          ? {
              ...current.blueprint,
              skillKeys: [...current.blueprint.skillKeys],
              rubricKeys: [...current.blueprint.rubricKeys],
              answerExcerpts: [...current.blueprint.answerExcerpts]
            }
          : undefined
      }
    : {
        ownership: [],
        decision: [],
        specificity: [],
        outcome: [],
        gaps: ["ownership", "decision", "specificity", "outcome"]
      };
  const snippet = answer.replace(/\s+/g, " ").trim().slice(0, 240);
  if (
    snippet &&
    !ledger.blueprint &&
    setup.personalizedPlanId &&
    setup.personalizedBlueprint &&
    question.blueprintStage &&
    question.topicKey
  ) {
    ledger.blueprint = {
      planId: setup.personalizedPlanId,
      blueprintId: setup.personalizedBlueprint.id,
      stage: question.blueprintStage,
      topicKey: question.topicKey,
      skillKeys: [...(question.skillKeys ?? [])],
      rubricKeys: [...(question.rubricKeys ?? [])],
      answerExcerpts: []
    };
  }
  if (snippet && ledger.blueprint) {
    ledger.blueprint.answerExcerpts = [
      ...ledger.blueprint.answerExcerpts.filter((item) => item !== snippet),
      snippet
    ].slice(-3);
  }
  const dimensions: EvidenceDimension[] = [];

  if (/\b(i|i'm|i’ve|i've|my|personally|owned|led|built|implemented|designed)\b/i.test(answer)) {
    dimensions.push("ownership");
  }
  if (/\b(because|chose|decided|trade[- ]?off|alternative|instead|reason)\b/i.test(answer)) {
    dimensions.push("decision");
  }
  if (
    /\b\d+(?:\.\d+)?(?:%|ms|s|x|k|m|gb|tb)?\b|\b(redis|react|typescript|javascript|api|database|queue|cache|kafka|postgres|sql)\b/i.test(
      answer
    )
  ) {
    dimensions.push("specificity");
  }
  if (
    /\b(result|impact|improved|reduced|increased|saved|grew|measured|outcome|users?|latency|revenue)\b/i.test(
      answer
    )
  ) {
    dimensions.push("outcome");
  }

  for (const dimension of dimensions) {
    ledger[dimension] = [...ledger[dimension].filter((item) => item !== snippet), snippet].slice(
      -3
    );
  }

  const knownGaps = new Set<EvidenceDimension>(ledger.gaps);
  for (const dimension of dimensions) knownGaps.delete(dimension);
  const missingDimension = evidenceDimensionForMissing(missing);
  if (missingDimension) knownGaps.add(missingDimension);
  return { ...ledger, gaps: [...knownGaps] };
}

function topicLabelFor(setup: InterviewSetup, question: PlannedQuestion): string | undefined {
  return setup.personalizedBlueprint?.topics.find((topic) => topic.key === question.topicKey)
    ?.label;
}

function rubricFor(setup: InterviewSetup, question: PlannedQuestion) {
  const rubricKeys = new Set(question.rubricKeys ?? []);
  if (!rubricKeys.size) return undefined;
  return setup.personalizedBlueprint?.rubric.filter((rubric) => rubricKeys.has(rubric.key));
}

function evidenceDimensionForMissing(value: string): EvidenceDimension | null {
  switch (value as MissingDimension) {
    case "specificity":
      return "specificity";
    case "ownership":
      return "ownership";
    case "outcome":
      return "outcome";
    case "structure":
    case "clarity":
      return "decision";
    default:
      return null;
  }
}

function answerResponse(
  state: InterviewState,
  decision: Decision,
  now: number
): InterviewAnswerResponse {
  return {
    action: decision.action,
    utterance: decision.utterance,
    missing: decision.missing,
    forcedBy: decision.forcedBy,
    phase: state.phase,
    questionIndex: state.questionIndex,
    questionCount: state.plan.length,
    followUpCount: state.followUpCount,
    elapsedMs: elapsedMs(state, now)
  };
}

function answerPayloadHash(answer: { text: string; startMs: number; endMs: number }): string {
  return createHash("sha256").update(answer.text).digest("hex");
}

function concurrentTurnError(sessionId: string): ConflictErrorException {
  return new ConflictErrorException(
    "SESSION_VERSION_CONFLICT",
    "Another answer changed this interview first. Reload the session before continuing.",
    { sessionId, retryable: false }
  );
}

function sessionMutationError(error: unknown, sessionId: string): unknown {
  return error instanceof SessionVersionConflictError ? concurrentTurnError(sessionId) : error;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function introUtterance(state: InterviewState): string {
  const first = state.plan[0];
  const minutes = Math.round(roundCaps(state.setup).hardCapMs / 60000);
  const intro =
    state.setup.templateTitle === "DSA practice interview"
      ? "Hi, I'm Maya. Welcome to your DSA interview. I picked a few problems you've already solved in practice, and we'll talk through them like a real coding round. Take your time, explain your thinking, and I'll jump in when a follow-up is useful."
      : state.setup.fundamentalsRound
        ? "Hi, I'm Maya. This is a computer fundamentals round, in three parts. A few quick checks first, then I'll ask you to explain the mechanism behind some of them, and we'll finish by diagnosing something real. After each answer I'll show you what I was listening for."
        : isResumeRound(state.setup)
          ? "Hi, I'm Maya. Let's have a relaxed conversation about the work on your resume. I'll pick a few threads and ask about what actually happened, what you did, and what changed. Take your time."
          : `Hi, I'm Maya, your Trailgrad interviewer. We'll spend about ${minutes} minutes on this ${state.setup.roundType.replace("-", " ")} conversation. I'll ask one question at a time, and you can pause to think.`;

  return first ? `${intro} ${first.text}` : intro;
}

export function closingDecision(): Decision {
  return {
    action: "move_on",
    missing: "none",
    reason: "interview complete",
    utterance: "That's time. Thanks for doing this.",
    forcedBy: null
  };
}
