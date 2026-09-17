import { createHash, randomUUID } from "node:crypto";
import { Logger } from "@/server/common/logger";
import { BadRequestErrorException } from "@/server/common/exceptions/bad-request-error.exception";
import { ConflictErrorException } from "@/server/common/exceptions/conflict-error.exception";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";
import {
  candidateConversationFallback,
  classifyCandidateTurn,
  InterviewDecider,
  normaliseMissing
} from "./decider";
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
import { createReportsOverview } from "@/features/reports/application/reports-overview";
import type { ReportsOverview } from "@/features/reports/contracts/reports";
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
  LiveConversationProposal,
  MissingDimension,
  PlannedQuestion,
  QuestionEvaluation,
  isResumableBlockAssessment,
  roundCaps
} from "./types";
import { isResumeRound } from "./prompt-context";
import { gradeMultipleChoice, multipleChoiceReply } from "./resume-round";
import {
  shouldEvaluateTechnicalAnswer,
  type TechnicalAnswerEvaluator
} from "./technical-answer-evaluator";
import { fencedCodeFingerprint } from "./code-fingerprint";
import {
  dsaBlockAssessmentMoveOnUtterance,
  dsaBlockAssessmentOpening,
  dsaBlockAssessmentReviewFeedback
} from "./dsa-block-assessment-dialogue";
import { dsaDesignMoveOnUtterance } from "./dsa-design-dialogue";
import {
  storyPracticeAssessmentDialogue,
  storyPracticeAssessmentMoveOnUtterance,
  storyPracticeAssessmentOpening
} from "./story-practice-assessment-dialogue";
import { storyPracticeAssessmentIdentityFromSetup } from "@/features/practice/shared/server/contracts";
import {
  answerTexts,
  evaluationAnswerHash,
  type EvaluationRecoveryMutation,
  type EvaluationRecoveryPayload
} from "./evaluation-recovery";
import { INTERVIEW_DECIDER_PROMPT_VERSION, INTERVIEW_ENGINE_VERSION } from "./runtime-version";
import {
  LIVE_DECISION_DEADLINE_MS,
  LIVE_EVALUATION_DEADLINE_MS
} from "../domain/voice-turn-timing";
import { usesGeminiLedConversation } from "../domain/gemini-live-conversation";
import {
  isDsaDesignRound,
  isDsaInterviewRound,
  isSystemDesignRound
} from "../domain/dsa-design-round";
import { interviewerNameForSetup } from "../domain/interviewer-persona";
import { isTechnicalProjectsRound } from "../domain/technical-deep-dive";
import { technicalProjectsMoveOnUtterance } from "./technical-projects-dialogue";
import { SESSION_TTL_MS } from "./session-constants";
import {
  EMPTY_SYSTEM_DESIGN_CANVAS,
  systemDesignCanvasDocumentSchema,
  type SystemDesignCanvasDocument,
  type VersionedSystemDesignCanvas
} from "../domain/system-design-canvas";

const DAY_MS = 24 * 60 * 60 * 1000;
/** A spoken conversation should never wait on the model's full provider timeout. */
const DECIDER_BUDGET_MS = LIVE_DECISION_DEADLINE_MS;
const EVALUATOR_BUDGET_MS = LIVE_EVALUATION_DEADLINE_MS;

export interface StartResult {
  state: InterviewState;
  utterance: string;
  created: boolean;
}

export interface AnswerResult {
  state: InterviewState;
  decision: Decision;
  response: InterviewAnswerResponse;
}

type AnswerMode = "answer" | "skip-block-assessment-code";
type CandidateSubmissionSource = "voice" | "workspace";

/** Server-only source of answer keys for frozen block-assessment review MCQs. */
export interface BlockAssessmentMcqGrader {
  gradeReviewAnswer(
    ownerId: string | undefined,
    setup: InterviewSetup,
    reviewItemId: string,
    answer: string
  ): Promise<{ correct: boolean; explanation: string; correctAnswer?: string } | null>;
}

const ANSWER_REPLAY_WAIT_MS = 5_000;
const ANSWER_REPLAY_POLL_MS = 100;

export class InterviewService {
  private readonly logger = new Logger(InterviewService.name);
  private blockAssessmentMcqGrader?: BlockAssessmentMcqGrader;

  constructor(
    private readonly planner: InterviewPlanner,
    private readonly decider: InterviewDecider,
    private readonly store: SessionStore,
    /** Configurable so local iteration is not throttled by the product cap. */
    private readonly dailyLimit = 2,
    private readonly answerEvaluator?: TechnicalAnswerEvaluator
  ) {}

  /** Wired after the runtime service is created to avoid a construction cycle. */
  setBlockAssessmentMcqGrader(grader: BlockAssessmentMcqGrader): void {
    this.blockAssessmentMcqGrader = grader;
  }

  /**
   * `prebuiltPlan` is for rounds that are assembled from stored content rather
   * than planned by the model, which is what makes the resume round free to
   * start. Everything else still goes through the planner.
   */
  async start(
    setup: InterviewSetup,
    ownerId: string,
    now = Date.now(),
    prebuiltPlan?: PlannedQuestion[],
    sessionId?: string
  ): Promise<StartResult> {
    if (sessionId) {
      const existing = await this.store.getOwned(sessionId, ownerId);
      if (existing) {
        const session = isIncompleteBlockAssessment(existing.state)
          ? ((await this.store.reactivateOwned(sessionId, ownerId)) ?? existing)
          : existing;
        return {
          state: session.state,
          utterance:
            session.state.turns.find((turn) => turn.speaker === "agent" && turn.action === "intro")
              ?.text ?? introUtterance(session.state),
          created: false
        };
      }
    }
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

    const state = createState({ id: sessionId ?? randomUUID(), setup, plan, startedAt: now });
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

    return { state: withIntro, utterance, created: true };
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

  /**
   * Returns the unfinished room for a permanent interview family. Launch
   * routes call this while holding their creation lease so revisiting a round
   * resumes the durable session instead of consuming quota and starting over.
   */
  async findOwnedActiveByTemplate(
    ownerId: string,
    templateId: string,
    now = Date.now()
  ): Promise<InterviewState | null> {
    const sessions = await this.store.listByOwner(ownerId, 50);
    const active = sessions.find(
      (session) =>
        session.state.phase !== "done" &&
        session.state.setup.templateId === templateId &&
        now - session.touchedAt <= SESSION_TTL_MS
    );
    return active?.state ?? null;
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
  async reportsOverview(
    ownerId: string,
    limit = 50,
    now = Date.now(),
    additionalReports: InterviewReport[] = []
  ): Promise<ReportsOverview> {
    const boundedLimit = Math.max(1, Math.min(limit, 50));
    const stored = await this.store.listReportsByOwner(ownerId, boundedLimit, now);
    const combined = [...stored, ...additionalReports]
      .sort((left, right) => right.startedAt - left.startedAt)
      .slice(0, boundedLimit);
    return createReportsOverview(combined, now);
  }

  async report(ownerId: string, sessionId: string, now = Date.now()): Promise<InterviewReport> {
    const session = await this.store.getOwned(sessionId, ownerId);
    if (!session) {
      throw new NotFoundErrorException("SESSION_NOT_FOUND", "Interview session not found", {
        sessionId
      });
    }

    const report = createInterviewReport(session, now);
    if (!isSystemDesignRound(session.state.setup)) return report;
    return {
      ...report,
      designCanvas: await this.getSystemDesignCanvas(ownerId, sessionId)
    };
  }

  /** Unowned lookup reserved for a route that already verified an agent capability. */
  async get(sessionId: string, ownerId?: string): Promise<InterviewState> {
    return (await this.versionedSession(sessionId, ownerId)).state;
  }

  private async versionedSession(
    sessionId: string,
    ownerId?: string
  ): Promise<VersionedInterviewSession> {
    let session = ownerId
      ? await this.store.getActiveOwnedVersioned(sessionId, ownerId)
      : await this.store.getVersioned(sessionId);
    if (!session && ownerId) {
      const durable = await this.store.getOwned(sessionId, ownerId);
      if (durable && isIncompleteBlockAssessment(durable.state)) {
        session = await this.store.reactivateOwned(sessionId, ownerId);
      }
    }
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

  async getSystemDesignCanvas(
    ownerId: string,
    sessionId: string
  ): Promise<VersionedSystemDesignCanvas> {
    const session = await this.store.getOwned(sessionId, ownerId);
    if (!session) {
      throw new NotFoundErrorException("SESSION_NOT_FOUND", "Interview session not found", {
        sessionId
      });
    }
    if (!isSystemDesignRound(session.state.setup)) {
      throw new BadRequestErrorException(
        "DESIGN_CANVAS_NOT_AVAILABLE",
        "This interview does not use a system-design canvas.",
        { sessionId }
      );
    }
    const stored = await this.store.getDesignCanvas(sessionId, ownerId);
    if (stored) {
      const parsed = systemDesignCanvasDocumentSchema.safeParse(stored.document);
      return {
        ...stored,
        document: parsed.success ? parsed.data : EMPTY_SYSTEM_DESIGN_CANVAS
      };
    }
    return {
      document: EMPTY_SYSTEM_DESIGN_CANVAS,
      revision: 0,
      updatedAt: session.touchedAt
    };
  }

  async saveSystemDesignCanvas(
    ownerId: string,
    sessionId: string,
    document: SystemDesignCanvasDocument,
    expectedRevision: number
  ): Promise<VersionedSystemDesignCanvas> {
    await this.getSystemDesignCanvas(ownerId, sessionId);
    return this.store.saveDesignCanvas(
      sessionId,
      ownerId,
      systemDesignCanvasDocumentSchema.parse(document),
      expectedRevision
    );
  }

  /** Records execution separately from correctness so reports never equate compiling with passing. */
  async recordCodeExecution(
    ownerId: string,
    sessionId: string,
    questionIndex: number,
    execution: CodeExecutionEvidence
  ): Promise<InterviewState> {
    const session = await this.versionedSession(sessionId, ownerId);
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
    turnId?: string,
    liveProposal?: LiveConversationProposal,
    submissionSource: CandidateSubmissionSource = "voice"
  ): Promise<AnswerResult> {
    return this.answerInternal(
      sessionId,
      answer,
      now,
      undefined,
      turnId,
      "answer",
      liveProposal,
      submissionSource
    );
  }

  async answerOwned(
    ownerId: string,
    sessionId: string,
    answer: { text: string; startMs: number; endMs: number },
    now = Date.now(),
    turnId?: string,
    liveProposal?: LiveConversationProposal,
    submissionSource: CandidateSubmissionSource = "voice"
  ): Promise<AnswerResult> {
    return this.answerInternal(
      sessionId,
      answer,
      now,
      ownerId,
      turnId,
      "answer",
      liveProposal,
      submissionSource
    );
  }

  async skipBlockAssessmentCodeOwned(
    ownerId: string,
    sessionId: string,
    timing: { startMs: number; endMs: number },
    now = Date.now(),
    turnId?: string
  ): Promise<AnswerResult> {
    return this.answerInternal(
      sessionId,
      { text: "I can't solve this problem.", ...timing },
      now,
      ownerId,
      turnId,
      "skip-block-assessment-code"
    );
  }

  private async answerInternal(
    sessionId: string,
    answer: { text: string; startMs: number; endMs: number },
    now: number,
    ownerId?: string,
    turnId?: string,
    mode: AnswerMode = "answer",
    liveProposal?: LiveConversationProposal,
    submissionSource: CandidateSubmissionSource = "voice"
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
      return await this.processAnswer(
        session,
        sessionId,
        answer,
        now,
        ownerId,
        turnId,
        mode,
        liveProposal,
        submissionSource
      );
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
    ownerId?: string,
    turnId?: string,
    mode: AnswerMode = "answer",
    liveProposal?: LiveConversationProposal,
    submissionSource: CandidateSubmissionSource = "voice"
  ): Promise<AnswerResult> {
    const existing = session.state;

    if (liveProposal && !usesGeminiLedConversation(existing.setup)) {
      throw new BadRequestErrorException(
        "LIVE_PROPOSAL_NOT_ALLOWED",
        "Gemini-led decisions are not enabled for this interview family.",
        { sessionId }
      );
    }

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

    if (
      mode === "skip-block-assessment-code" &&
      (existing.setup.dsaBlockAssessment?.kind !== "dsa-block-assessment" ||
        question.kind !== "code")
    ) {
      throw new BadRequestErrorException(
        "ASSESSMENT_SKIP_NOT_ALLOWED",
        "Only an active block-assessment coding problem can be skipped.",
        { sessionId }
      );
    }

    const candidateNeedsBreak =
      mode === "answer" &&
      !isResumableBlockAssessment(existing.setup) &&
      candidateNeedsInterviewBreak(answer.text);
    const candidateRequestedQuestionSkip =
      mode === "answer" &&
      usesGeminiLedConversation(existing.setup) &&
      candidateRequestsQuestionSkip(answer.text);
    const candidateEndedInterview =
      mode === "answer" &&
      !isResumableBlockAssessment(existing.setup) &&
      !candidateNeedsBreak &&
      !candidateRequestedQuestionSkip &&
      (liveProposal?.candidateIntent === "end" || candidateRequestsInterviewEnd(answer.text));
    const candidateDeclinedQuestion =
      mode === "answer" &&
      usesGeminiLedConversation(existing.setup) &&
      !candidateNeedsBreak &&
      !candidateEndedInterview &&
      (candidateRequestedQuestionSkip ||
        liveProposal?.candidateIntent === "decline" ||
        candidateDeclinesQuestion(answer.text));
    const withAnswer = appendTurn(existing, {
      speaker: "user",
      text: answer.text,
      startMs: answer.startMs,
      endMs: answer.endMs,
      ...(candidateEndedInterview || candidateNeedsBreak
        ? {
            ...(candidateEndedInterview ? { endedInterview: true } : {}),
            ...(candidateNeedsBreak ? { assessmentExcluded: true } : {})
          }
        : { questionIndex: existing.questionIndex }),
      ...(mode === "skip-block-assessment-code" || candidateDeclinedQuestion
        ? { skipped: true }
        : {}),
      ...(candidateDeclinedQuestion ? { assessmentExcluded: true } : {}),
      submissionSource
    });

    if (mode === "skip-block-assessment-code") {
      return this.completeSkippedBlockAssessmentCode(
        withAnswer,
        question,
        now,
        session.version,
        turnId
      );
    }

    if (candidateEndedInterview) {
      return this.completeCandidateEndedInterview(withAnswer, now, session.version, turnId);
    }

    if (candidateNeedsBreak) {
      return this.completeCandidateBreakSupport(withAnswer, now, session.version, turnId);
    }

    if (candidateDeclinedQuestion) {
      return this.completeDeclinedQuestion(withAnswer, now, session.version, turnId);
    }

    // In combined rounds, spoken reasoning while a coding prompt is open
    // is context—not a submitted solution. Keep the question active and let
    // the workspace Submit action provide the authoritative answer boundary.
    // Explicit end/decline intents have already returned above, so this guard
    // only holds an ordinary answer/reasoning proposal from the live model;
    // clarification requests are still answered in the conversation.
    const holdingCodeThinkAloud =
      (isDsaInterviewRound(existing.setup) || isTechnicalProjectsRound(existing.setup)) &&
      question.kind === "code" &&
      submissionSource === "voice" &&
      !existing.turns.some(
        (turn) =>
          turn.speaker === "user" &&
          turn.questionIndex === existing.questionIndex &&
          turn.submissionSource === "workspace"
      ) &&
      Boolean(liveProposal) &&
      liveProposal?.candidateIntent !== "end" &&
      liveProposal?.candidateIntent !== "decline" &&
      liveProposal?.candidateIntent !== "question-or-clarification" &&
      !(liveProposal?.action === "respond" && Boolean(liveProposal.candidateResponse?.trim()));
    if (holdingCodeThinkAloud) {
      const utterance = codingPresenceAcknowledgement(withAnswer);
      const decision: Decision = {
        action: "respond",
        missing: "none",
        reason: "held spoken coding reasoning until the workspace submission",
        utterance,
        forcedBy: null
      };
      const spokenAt = elapsedMs(withAnswer, now);
      const withReply = appendTurn(withAnswer, {
        speaker: "agent",
        text: utterance,
        startMs: spokenAt,
        endMs: spokenAt,
        action: "respond",
        forcedBy: null,
        questionIndex: withAnswer.questionIndex
      });
      const response = answerResponse(withReply, decision, now);
      await this.persistAnswer(withReply, session.version, turnId, response);
      return { state: withReply, decision, response };
    }

    const conversationHistory = withAnswer.turns
      .slice(0, -1)
      .slice(-8)
      .map((turn) => ({ speaker: turn.speaker, text: turn.text.slice(0, 600) }));
    const candidateTurnMode = classifyCandidateTurn(answer.text, conversationHistory);
    const isDialogueRepair =
      candidateTurnMode === "conversation" && !question.acceptsCandidateQuestions;

    // A multiple choice answer is decided by comparison, not by the model. The
    // correct option and its explanation were written when the resume was read.
    if (question.dsaAssessmentReviewItemId && !this.blockAssessmentMcqGrader) {
      throw new BadRequestErrorException(
        "ASSESSMENT_ANSWER_KEY_UNAVAILABLE",
        "This assessment answer key is unavailable.",
        { sessionId }
      );
    }
    const assessmentGrade =
      !isDialogueRepair && question.dsaAssessmentReviewItemId
        ? await this.blockAssessmentMcqGrader!.gradeReviewAnswer(
            ownerId,
            withAnswer.setup,
            question.dsaAssessmentReviewItemId,
            answer.text
          )
        : null;
    const graded = isDialogueRepair
      ? null
      : (assessmentGrade ?? gradeMultipleChoice(question, answer.text));
    if (graded) {
      return this.completeGradedAnswer(
        withAnswer,
        question,
        graded.correct,
        now,
        session.version,
        turnId,
        assessmentGrade?.explanation,
        assessmentGrade?.correctAnswer
      );
    }

    const turnStartedAt = Date.now();
    const [raw, evaluationResult] = await Promise.all([
      liveProposal
        ? Promise.resolve({
            ...liveProposal,
            action:
              isDialogueRepair && liveProposal.action !== "respond"
                ? ("respond" as const)
                : liveProposal.action,
            missing: isDialogueRepair ? ("none" as const) : liveProposal.missing,
            acknowledgement: isDialogueRepair ? "" : liveProposal.acknowledgement,
            candidateResponse:
              isDialogueRepair && !liveProposal.candidateResponse?.trim()
                ? candidateConversationFallback(answer.text, conversationHistory)
                : liveProposal.candidateResponse,
            runtime: {
              engineVersion: INTERVIEW_ENGINE_VERSION,
              promptVersion: "gemini-live-conversation-v2",
              durationMs: 0,
              usedFallback: false,
              calls: []
            }
          })
        : this.decideWithFallback({
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
            interviewStage: question.stage,
            topicLabel: topicLabelFor(withAnswer.setup, question),
            blueprintDifficulty: question.blueprintDifficulty,
            rubric: rubricFor(withAnswer.setup, question),
            followUpPolicy: withAnswer.setup.personalizedBlueprint?.followUpPolicy,
            fallbackProbe: question.probeIfMissing,
            evidenceLedger: withAnswer.evidence?.[String(withAnswer.questionIndex)],
            dsaInterviewerGuide: question.dsaInterviewerGuide,
            coreTechnicalInterviewerGuide: question.coreTechnicalInterviewerGuide,
            storyPracticeInterviewerGuide: question.storyPracticeInterviewerGuide,
            acceptsCandidateQuestions: question.acceptsCandidateQuestions,
            candidateTurnMode,
            conversationHistory
          }),
      isDialogueRepair
        ? Promise.resolve({ evaluation: undefined, recovery: undefined })
        : this.evaluateAnswer(withAnswer, question, now, Boolean(liveProposal))
    ]);

    const requestedAction =
      question.acceptsCandidateQuestions && raw.action === "respond" ? "move_on" : raw.action;
    const result = advance(withAnswer, requestedAction, now);
    const decisionRuntime = raw.runtime ?? {
      engineVersion: INTERVIEW_ENGINE_VERSION,
      promptVersion: INTERVIEW_DECIDER_PROMPT_VERSION,
      durationMs: Date.now() - turnStartedAt,
      usedFallback: false,
      calls: []
    };
    const withEvidence: InterviewState =
      result.action === "respond"
        ? result.state
        : {
            ...result.state,
            evidence: {
              ...withAnswer.evidence,
              [String(withAnswer.questionIndex)]: recordEvidence(
                withAnswer.evidence?.[String(withAnswer.questionIndex)],
                answer.text,
                raw.missing,
                question,
                withAnswer.setup
              )
            },
            questionEvaluations: evaluationResult.evaluation
              ? {
                  ...result.state.questionEvaluations,
                  [String(withAnswer.questionIndex)]: evaluationResult.evaluation
                }
              : result.state.questionEvaluations
          };
    const acknowledgement =
      question.kind === "code" && submissionSource === "workspace"
        ? codeSubmissionAcknowledgement(withAnswer)
        : liveProposal
          ? liveAcknowledgement(raw.acknowledgement, result.action, withAnswer.turns)
          : naturalAcknowledgement(
              raw.acknowledgement,
              result.action,
              withAnswer.turns,
              result.state.followUpCount,
              answer.text
            );
    // The state machine can override a requested follow-up when its budget or
    // the round time is exhausted. Never carry the rejected model question
    // into a move-on response: doing so makes James ask that stale follow-up
    // and the next planned question in the same breath.
    const generatedLine = singleQuestion(stripGenericLead(raw.line?.trim() ?? ""));
    const approvedLine =
      result.action === "move_on"
        ? ""
        : result.action === "respond"
          ? liveProposal?.candidateIntent === "other" && !generatedLine
            ? ""
            : conversationalReturnQuestion(generatedLine, question.text)
          : qualityCheckedFollowUp(
              generatedLine,
              question.text,
              withAnswer.turns,
              fallbackProbeFor({
                setup: withAnswer.setup,
                interviewStage: question.stage,
                followUpCount: withAnswer.followUpCount,
                fallbackProbe: question.probeIfMissing
              })
            );
    const candidateResponse =
      result.action === "respond"
        ? safeConversationalResponse(
            raw.candidateResponse,
            interviewerNameForSetup(withEvidence.setup)
          )
        : question.acceptsCandidateQuestions
          ? safeCandidateResponse(
              raw.candidateResponse,
              interviewerNameForSetup(withEvidence.setup)
            )
          : "";
    const spokenBridge = joinSpoken(acknowledgement, candidateResponse);
    const utterance = this.composeUtterance(
      withEvidence,
      result.action,
      joinSpoken(spokenBridge, approvedLine)
    );

    const spokenAt = elapsedMs(result.state, now);
    const withReply = appendTurn(withEvidence, {
      speaker: "agent",
      text: utterance,
      startMs: spokenAt,
      endMs: spokenAt,
      action: result.action,
      forcedBy: result.forcedBy,
      questionIndex: result.state.questionIndex,
      runtime: decisionRuntime
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
    await this.persistAnswer(
      finalState,
      session.version,
      turnId,
      response,
      evaluationResult.recovery
    );

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
        elapsedMs: elapsedMs(finalState, now),
        turnDurationMs: Date.now() - turnStartedAt,
        decisionDurationMs: decisionRuntime.durationMs,
        evaluationDurationMs: evaluationResult.evaluation?.runtime?.durationMs ?? null,
        evaluationStatus: evaluationResult.recovery
          ? "queued"
          : (evaluationResult.evaluation?.source ?? "not-required"),
        engineVersion: INTERVIEW_ENGINE_VERSION,
        deciderPromptVersion: INTERVIEW_DECIDER_PROMPT_VERSION
      })
    );

    return { state: finalState, decision, response };
  }

  private async completeCandidateEndedInterview(
    state: InterviewState,
    now: number,
    expectedVersion: number,
    turnId?: string
  ): Promise<AnswerResult> {
    const closed = finish(state);
    const utterance = candidateEndUtterance();
    const spokenAt = elapsedMs(closed, now);
    const finalState = appendTurn(closed, {
      speaker: "agent",
      text: utterance,
      startMs: spokenAt,
      endMs: spokenAt,
      action: "move_on"
    });
    const decision: Decision = {
      action: "move_on",
      missing: "none",
      reason: "candidate explicitly ended the interview",
      utterance,
      forcedBy: null
    };
    const response = answerResponse(finalState, decision, now);
    await this.persistAnswer(finalState, expectedVersion, turnId, response);

    this.logger.log(
      JSON.stringify({
        event: "interview.candidate-ended",
        sessionId: finalState.id,
        questionIndex: finalState.questionIndex,
        elapsedMs: elapsedMs(finalState, now)
      })
    );

    return { state: finalState, decision, response };
  }

  private async completeCandidateBreakSupport(
    state: InterviewState,
    now: number,
    expectedVersion: number,
    turnId?: string
  ): Promise<AnswerResult> {
    const utterance =
      "It sounds like you need some rest. Take a short break if you need one. If you want to stop now, say “end the interview”; otherwise, we can continue when you're ready.";
    const spokenAt = elapsedMs(state, now);
    const finalState = appendTurn(state, {
      speaker: "agent",
      text: utterance,
      startMs: spokenAt,
      endMs: spokenAt,
      action: "respond",
      questionIndex: state.questionIndex
    });
    const decision: Decision = {
      action: "respond",
      missing: "none",
      reason: "candidate expressed fatigue and needs a supportive choice",
      utterance,
      forcedBy: null
    };
    const response = answerResponse(finalState, decision, now);
    await this.persistAnswer(finalState, expectedVersion, turnId, response);

    this.logger.log(
      JSON.stringify({
        event: "interview.break-suggested",
        sessionId: finalState.id,
        questionIndex: finalState.questionIndex,
        elapsedMs: elapsedMs(finalState, now)
      })
    );

    return { state: finalState, decision, response };
  }

  /**
   * A refusal is consent, not weak interview evidence. Respect it immediately,
   * exclude it from scoring, and never let an LLM turn it into praise or a
   * follow-up. Repeated refusals close the interview instead of interrogating
   * the candidate through every remaining prompt.
   */
  private async completeDeclinedQuestion(
    state: InterviewState,
    now: number,
    expectedVersion: number,
    turnId?: string
  ): Promise<AnswerResult> {
    const refusalCount = consecutiveQuestionDeclines(state);
    const shouldEnd = refusalCount >= 3;
    const result = shouldEnd
      ? { state: finish(state), action: "move_on" as const, forcedBy: null }
      : advance(state, "move_on", now);
    const acknowledgement = shouldEnd
      ? "Understood. Since you'd prefer not to answer these questions, I'll end the interview here. Thank you for your time."
      : "Understood — we'll skip that one.";
    const utterance = shouldEnd
      ? acknowledgement
      : this.composeUtterance(result.state, result.action, acknowledgement);
    const spokenAt = elapsedMs(result.state, now);
    const finalState = appendTurn(result.state, {
      speaker: "agent",
      text: utterance,
      startMs: spokenAt,
      endMs: spokenAt,
      action: "move_on",
      forcedBy: result.forcedBy,
      questionIndex: result.state.questionIndex
    });
    const decision: Decision = {
      action: "move_on",
      missing: "none",
      reason: shouldEnd
        ? "candidate repeatedly declined interview questions"
        : "candidate declined the current question",
      utterance,
      forcedBy: result.forcedBy
    };
    const response = answerResponse(finalState, decision, now);
    await this.persistAnswer(finalState, expectedVersion, turnId, response);

    this.logger.log(
      JSON.stringify({
        event: shouldEnd ? "interview.declined-ended" : "interview.question-declined",
        sessionId: finalState.id,
        refusalCount,
        questionIndex: finalState.questionIndex,
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
    turnId?: string,
    serverExplanation?: string,
    serverCorrectAnswer?: string
  ): Promise<AnswerResult> {
    const evaluatedState: InterviewState = {
      ...state,
      questionEvaluations: {
        ...state.questionEvaluations,
        [String(state.questionIndex)]: multipleChoiceEvaluation(state, question, correct, now)
      }
    };
    const result = advance(evaluatedState, "move_on", now);
    const feedback = isTechnicalProjectsRound(state.setup)
      ? ""
      : state.setup.dsaBlockAssessment?.kind === "dsa-block-assessment"
        ? dsaBlockAssessmentReviewFeedback({
            sessionId: state.id,
            questionIndex: state.questionIndex,
            correct,
            explanation: serverExplanation ?? question.explanation,
            correctAnswer: serverCorrectAnswer
          })
        : multipleChoiceReply(
            serverExplanation === undefined
              ? question
              : { ...question, explanation: serverExplanation },
            correct
          );
    const utterance = this.composeUtterance(result.state, result.action, feedback);
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

  private async completeSkippedBlockAssessmentCode(
    state: InterviewState,
    question: PlannedQuestion,
    now: number,
    expectedVersion: number,
    turnId?: string
  ): Promise<AnswerResult> {
    const questionIndex = state.questionIndex;
    const evaluatedState: InterviewState = {
      ...state,
      questionEvaluations: {
        ...state.questionEvaluations,
        [String(questionIndex)]: skippedCodeEvaluation(question, now)
      }
    };
    const result = advance(evaluatedState, "move_on", now);
    const utterance = this.composeUtterance(
      result.state,
      "move_on",
      "Okay. I've marked this problem as skipped."
    );
    const spokenAt = elapsedMs(result.state, now);
    const finalState = appendTurn(result.state, {
      speaker: "agent",
      text: utterance,
      startMs: spokenAt,
      endMs: spokenAt,
      action: "move_on",
      forcedBy: result.forcedBy,
      questionIndex: result.state.questionIndex,
      gradedQuestionIndex: questionIndex
    });
    const decision: Decision = {
      action: "move_on",
      missing: "specificity",
      reason: "candidate explicitly skipped the coding problem",
      utterance,
      forcedBy: result.forcedBy
    };
    const response = answerResponse(finalState, decision, now);
    await this.persistAnswer(finalState, expectedVersion, turnId, response);
    return { state: finalState, decision, response };
  }

  async end(sessionId: string, ownerId?: string): Promise<InterviewState> {
    const session = await this.versionedSession(sessionId, ownerId);
    if (isResumableBlockAssessment(session.state.setup) && session.state.phase !== "done") {
      throw new BadRequestErrorException(
        "ASSESSMENT_INCOMPLETE",
        "Complete every assessment question before submitting.",
        { sessionId }
      );
    }
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
    response: InterviewAnswerResponse,
    evaluationRecovery?: EvaluationRecoveryMutation
  ): Promise<void> {
    if (turnId) {
      await this.store.completeAnswer(state, expectedVersion, turnId, response, evaluationRecovery);
      return;
    }
    await this.store.save(state, expectedVersion, evaluationRecovery);
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
    now: number,
    defer = false
  ): Promise<{
    evaluation: QuestionEvaluation | null;
    recovery?: EvaluationRecoveryMutation;
  }> {
    if (!shouldEvaluateTechnicalAnswer(state.setup, question)) {
      return { evaluation: null };
    }

    const questionIndex = state.questionIndex;
    const answers = answerTexts(state, questionIndex);
    const input = {
      setup: state.setup,
      question,
      answers,
      rubric: rubricFor(state.setup, question) ?? [],
      execution: executionForEvaluation(state, questionIndex, answers),
      evaluatedAt: now
    };
    const recoveryPayload: EvaluationRecoveryPayload = {
      ...input,
      sessionId: state.id,
      questionIndex,
      answerHash: evaluationAnswerHash(answers),
      queuedAt: now
    };
    // Gemini-led conversational turns must not wait for a second model before
    // James can speak. Persist an unavailable placeholder and a durable job in
    // the same transaction as the answer; the route starts recovery after the
    // response has been returned.
    if (defer) {
      return {
        evaluation: unavailableTechnicalEvaluation(state, question, now),
        recovery: { action: "enqueue", payload: recoveryPayload }
      };
    }
    if (!this.answerEvaluator) {
      return {
        evaluation: unavailableTechnicalEvaluation(state, question, now),
        recovery: { action: "enqueue", payload: recoveryPayload }
      };
    }

    try {
      const evaluation = await withinAbortable(
        (signal) => this.answerEvaluator!.evaluate({ ...input, signal }),
        EVALUATOR_BUDGET_MS,
        "Interview answer evaluator"
      );
      return { evaluation, recovery: { action: "resolve", questionIndex } };
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: "interview.answer-evaluation.fallback",
          sessionId: state.id,
          questionIndex,
          reason: error instanceof Error ? error.name : "unknown"
        })
      );
      return {
        evaluation: unavailableTechnicalEvaluation(state, question, now),
        recovery: { action: "enqueue", payload: recoveryPayload }
      };
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
    interviewStage?: PlannedQuestion["stage"];
    topicLabel?: string;
    blueprintDifficulty?: PlannedQuestion["blueprintDifficulty"];
    rubric?: NonNullable<InterviewSetup["personalizedBlueprint"]>["rubric"];
    followUpPolicy?: NonNullable<InterviewSetup["personalizedBlueprint"]>["followUpPolicy"];
    fallbackProbe: string;
    conversationHistory: Array<{ speaker: "agent" | "user"; text: string }>;
    evidenceLedger?: EvidenceLedger;
    dsaInterviewerGuide?: PlannedQuestion["dsaInterviewerGuide"];
    coreTechnicalInterviewerGuide?: PlannedQuestion["coreTechnicalInterviewerGuide"];
    storyPracticeInterviewerGuide?: PlannedQuestion["storyPracticeInterviewerGuide"];
    acceptsCandidateQuestions?: boolean;
    candidateTurnMode?: "answer" | "conversation";
  }) {
    try {
      return await withinAbortable(
        (signal) => this.decider.decide({ ...input, signal }),
        DECIDER_BUDGET_MS,
        "Interview decider"
      );
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: "interview.decide.fallback",
          reason: error instanceof Error ? error.name : "unknown"
        })
      );

      if (input.candidateTurnMode === "conversation" && !input.acceptsCandidateQuestions) {
        return {
          action: "respond" as const,
          missing: "none" as const,
          reason: "candidate initiated a conversational turn; used local dialogue repair",
          acknowledgement: "",
          line: input.questionAsked,
          candidateResponse: candidateConversationFallback(
            input.userAnswer,
            input.conversationHistory
          ),
          runtime: {
            engineVersion: INTERVIEW_ENGINE_VERSION,
            promptVersion: INTERVIEW_DECIDER_PROMPT_VERSION,
            durationMs: 0,
            usedFallback: true,
            calls: []
          }
        };
      }

      const shouldMove = input.followUpCount >= Math.max(0, input.maxFollowUps ?? 2);
      return {
        action: shouldMove ? ("move_on" as const) : ("probe" as const),
        missing: "specificity",
        reason: "decider unavailable; used planned fallback",
        acknowledgement: shouldMove
          ? ["That helps", "Right, I see the thread", "That gives me a clearer picture"][
              input.followUpCount % 3
            ]
          : "",
        line: shouldMove ? "" : fallbackProbeFor(input),
        candidateResponse:
          input.acceptsCandidateQuestions && soundsLikeCandidateQuestion(input.userAnswer)
            ? simulatedCandidateQuestionFallback(input.setup.role)
            : "",
        runtime: {
          engineVersion: INTERVIEW_ENGINE_VERSION,
          promptVersion: INTERVIEW_DECIDER_PROMPT_VERSION,
          durationMs: 0,
          usedFallback: true,
          calls: []
        }
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

    if (state.setup.dsaBlockAssessment?.kind === "dsa-block-assessment") {
      return dsaBlockAssessmentMoveOnUtterance(state, acknowledgement);
    }
    if (isDsaDesignRound(state.setup)) {
      return dsaDesignMoveOnUtterance(state, acknowledgement);
    }
    if (isTechnicalProjectsRound(state.setup)) {
      return technicalProjectsMoveOnUtterance(state, acknowledgement);
    }
    const storyPracticeIdentity = storyPracticeAssessmentIdentityFromSetup(state.setup);
    if (storyPracticeIdentity) {
      return storyPracticeAssessmentMoveOnUtterance(
        state,
        acknowledgement,
        storyPracticeAssessmentDialogue(storyPracticeIdentity.practice)
      );
    }

    if (state.phase === "done" || state.phase === "wrap") {
      return joinSpoken(
        acknowledgement,
        "That covers everything I wanted to explore, so we'll end the interview here. Thanks for the conversation. Your feedback will be ready shortly."
      );
    }

    const next = currentQuestion(state);
    if (!next) {
      return joinSpoken(
        acknowledgement,
        "That covers everything I wanted to explore, so we'll end the interview here. Thanks for the conversation."
      );
    }

    return joinSpoken(acknowledgement, candidateFacingQuestion(next, state.setup));
  }
}

function fallbackProbeFor(input: {
  setup: InterviewSetup;
  interviewStage?: PlannedQuestion["stage"];
  followUpCount: number;
  fallbackProbe: string;
}): string {
  if (input.setup.roundType !== "hiring-manager" || input.followUpCount === 0) {
    return input.fallbackProbe;
  }

  if (input.interviewStage === "career") {
    return input.followUpCount === 1
      ? "How did that turning point change what you wanted from your next role?"
      : "Which part of that journey best explains the move you want to make now?";
  }
  if (input.interviewStage === "current-role") {
    return "What trade-off would you accept to protect that priority?";
  }
  if (input.interviewStage === "project") {
    return "Looking back, what would you handle differently, and why?";
  }
  return "What did that experience change about how you work now?";
}

async function withinAbortable<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();

  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error(`${label} timed out`));
        }, timeoutMs);
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
  const rubricKeys = question.evaluationParameterKeys?.length
    ? question.evaluationParameterKeys
    : question.rubricKeys?.length
      ? question.rubricKeys
      : [question.competency ?? "technical-correctness"];
  const reviewedExplanation = isTechnicalProjectsRound(state.setup)
    ? question.explanation?.trim()
    : undefined;
  const resultSummary = correct
    ? "The selected answer matches the authored correct option."
    : "The selected answer does not match the authored correct option.";

  return {
    source: "local-mcq",
    score: correct ? 100 : 0,
    verdict: correct ? "correct" : "incorrect",
    confidence: 1,
    // The explanation is retained in the completed report evaluation, but is
    // never included in the live question serializer or Claire's response.
    summary: reviewedExplanation ? `${resultSummary} ${reviewedExplanation}` : resultSummary,
    strengths: correct ? ["Selected the technically correct option."] : [],
    gaps: correct ? [] : ["Review the underlying concept and the authored correct option."],
    rubricScores: rubricKeys.map((rubricKey) => ({
      rubricKey,
      score: correct ? 100 : 0,
      rationale: correct
        ? (reviewedExplanation ?? "Matched the authored answer key.")
        : (reviewedExplanation ?? "Did not match the authored answer key.")
    })),
    answerExcerpts: answer ? [answer.replace(/\s+/g, " ").trim().slice(0, 240)] : [],
    execution: null,
    evaluatedAt
  };
}

function skippedCodeEvaluation(question: PlannedQuestion, evaluatedAt: number): QuestionEvaluation {
  return {
    source: "evaluation-unavailable",
    score: 0,
    verdict: "insufficient-evidence",
    confidence: 1,
    summary: "The candidate explicitly skipped this coding problem.",
    strengths: [],
    gaps: ["No solution evidence was submitted for this coding problem."],
    rubricScores: (question.evaluationParameterKeys ?? question.rubricKeys ?? []).map(
      (rubricKey) => ({
        rubricKey,
        score: 0,
        rationale: "The candidate explicitly skipped this coding problem."
      })
    ),
    answerExcerpts: [],
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
    rubricScores: (question.evaluationParameterKeys ?? question.rubricKeys ?? []).map(
      (rubricKey) => ({
        rubricKey,
        score: 0,
        rationale: "Not scored because the correctness evaluator was unavailable."
      })
    ),
    answerExcerpts: answers,
    execution: state.codeExecutions?.[String(state.questionIndex)] ?? null,
    evaluatedAt
  };
}

function joinSpoken(bridge: string, sentence: string): string {
  if (bridge.length === 0) return sentence;
  if (sentence.length === 0) return bridge;
  return /[.!?]$/.test(bridge) ? `${bridge} ${sentence}` : `${bridge}. ${sentence}`;
}

function safeCandidateResponse(value: string | undefined, interviewerName: "Claire" | "James") {
  const normalized = value?.replace(/\s+/g, " ").trim() ?? "";
  if (!normalized) return "";
  if (disclosesProviderIdentity(normalized)) return recruitingIdentity(interviewerName);
  const transparent = /\b(?:simulation|specific employer|speaking generally)\b/i.test(normalized)
    ? normalized
    : `Speaking generally for this simulation, ${normalized}`;
  if (transparent.length <= 360) return transparent;
  const prefix = transparent.slice(0, 359);
  const lastSpace = prefix.lastIndexOf(" ");
  return `${prefix.slice(0, lastSpace > 180 ? lastSpace : prefix.length).trimEnd()}…`;
}

function safeConversationalResponse(
  value: string | undefined,
  interviewerName: "Claire" | "James"
) {
  const normalized = value?.replace(/\s+/g, " ").trim() ?? "";
  if (!normalized) return "Let me answer that directly.";
  if (disclosesProviderIdentity(normalized)) return recruitingIdentity(interviewerName);
  if (normalized.length <= 360) return normalized;
  const prefix = normalized.slice(0, 359);
  const lastSpace = prefix.lastIndexOf(" ");
  return `${prefix.slice(0, lastSpace > 180 ? lastSpace : prefix.length).trimEnd()}…`;
}

function disclosesProviderIdentity(value: string): boolean {
  return (
    /\b(?:google|gemini|deepmind)\b/i.test(value) ||
    /\b(?:ai|artificial intelligence|language)\s+(?:assistant|model|bot)\b/i.test(value) ||
    /\b(?:chatbot|virtual assistant|large language model|llm)\b/i.test(value)
  );
}

function recruitingIdentity(interviewerName: "Claire" | "James"): string {
  return `I'm ${interviewerName} from the recruiting team.`;
}

function conversationalReturnQuestion(candidate: string, questionAsked: string): string {
  const question = singleQuestion(candidate.trim());
  return question.includes("?") ? question : singleQuestion(questionAsked.trim());
}

function soundsLikeCandidateQuestion(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    normalized.includes("?") ||
    /\b(?:i(?:'d| would) like to ask|my question|can you|could you|would you|what (?:is|are|does|do)|how (?:is|are|does|do)|tell me about)\b/.test(
      normalized
    )
  );
}

function simulatedCandidateQuestionFallback(role: InterviewSetup["role"]): string {
  const roleLabel = role === "ai-ml" ? "AI and ML" : role;
  return `I can’t represent a specific employer, but in this ${roleLabel} simulation I’d look for clear ownership, sound judgement, and reliable collaboration. Confirm the real team’s expectations with your interviewer.`;
}

const NATURAL_BRIDGES: Record<DecisionAction, string[]> = {
  clarify: ["Let me rephrase that.", "I want to make sure I’m following."],
  respond: [],
  probe: [
    "I hear what drew you there.",
    "That gives me a useful starting point.",
    "I can see the direction you took.",
    "I’m following the reason behind that."
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
  /^(?:yeah|yes|got it|gotcha|understood|i understand|i see|i hear that|you said|makes sense|okay|ok|right|that's fair|that is fair|that helps|that gives me (?:a useful thread|a useful starting point|a clear picture|a clearer picture)|great|excellent|good answer|thank(?:s| you) for sharing(?: that)?|i appreciate (?:you )?sharing(?: that)?|i (?:want to|wanna) (?:stay|stick) (?:with|to) (?:that|this) part)(?:[.!?,\s]|$)/i;

function stripGenericLead(text: string): string {
  return text
    .replace(
      /^(?:got it|gotcha|understood|i understand|makes sense|okay|ok|right|great|excellent|good answer|thanks for sharing|i (?:want to|wanna) (?:stay|stick) (?:with|to) (?:that|this) part)(?:[.!?,\s]+)+/i,
      ""
    )
    .trim();
}

function singleQuestion(text: string): string {
  const firstQuestionEnd = text.indexOf("?");
  return firstQuestionEnd >= 0 ? text.slice(0, firstQuestionEnd + 1).trim() : text;
}

/**
 * Deterministic last-mile guard for model output. A live interviewer must not
 * repeat the current/recent question or fall back to generic filler even when
 * a provider returns schema-valid but poor conversational text.
 */
export function qualityCheckedFollowUp(
  candidate: string,
  questionAsked: string,
  turns: InterviewState["turns"],
  fallback: string
): string {
  const normalized = normalizeQuestion(candidate);
  const recentQuestions = [
    questionAsked,
    ...turns
      .filter((turn) => turn.speaker === "agent")
      .slice(-4)
      .map((turn) => turn.text)
  ].map(normalizeQuestion);
  const generic = /^(?:can you (?:elaborate|expand)|tell me more|could you be more specific)\??$/i;

  if (
    !candidate.includes("?") ||
    generic.test(candidate.trim()) ||
    recentQuestions.some((question) => question && question === normalized)
  ) {
    return singleQuestion(fallback.trim());
  }
  return candidate;
}

function normalizeQuestion(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function naturalAcknowledgement(
  acknowledgement: string | undefined,
  action: DecisionAction,
  turns: InterviewState["turns"],
  sequence: number,
  answer: string
): string {
  if (action === "clarify" || action === "respond") return "";

  const candidate = acknowledgement?.trim() ?? "";
  if (candidate && !GENERIC_ACKNOWLEDGEMENT.test(candidate) && !recentlyUsed(candidate, turns)) {
    return candidate;
  }

  const contextual = contextualAcknowledgement(answer);
  if (contextual && !recentlyUsed(contextual, turns)) return contextual;

  const options = NATURAL_BRIDGES[action];
  for (let offset = 0; offset < options.length; offset += 1) {
    const option = options[(sequence + offset) % options.length];
    if (option && !recentlyUsed(option, turns)) return option;
  }

  return answer.trim() ? "I’m following what you’re saying." : "I’m with you.";
}

/**
 * Gemini owns the conversational bridge in Live rounds. The server removes
 * generic praise and repeated filler but does not invent a replacement.
 */
function liveAcknowledgement(
  acknowledgement: string | undefined,
  action: DecisionAction,
  turns: InterviewState["turns"]
): string {
  if (action === "clarify" || action === "respond") return "";
  const candidate = acknowledgement?.replace(/\s+/g, " ").trim() ?? "";
  if (!candidate || GENERIC_ACKNOWLEDGEMENT.test(candidate) || recentlyUsed(candidate, turns)) {
    return "";
  }
  return candidate.slice(0, 120);
}

function contextualAcknowledgement(answer: string): string | null {
  const normalized = answer.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (
    !/\b(?:because|since|chose|decided|implemented|designed|built|reduced|increased|improved|measured|trade[- ]?off)\b|\b\d+(?:\.\d+)?%?\b/i.test(
      normalized
    )
  ) {
    return null;
  }

  const reason = normalized.match(/\b(?:because|since)\s+(.+)/i)?.[1] ?? normalized;
  const reflected = reason
    .replace(/\bi(?:'ve| have)\b/gi, "you have")
    .replace(/\bi(?:'m| am)\b/gi, "you are")
    .replace(/\bi(?:'d| would)\b/gi, "you would")
    .replace(/\bmy\b/gi, "your")
    .replace(/\bme\b/gi, "you")
    .replace(/\bi\b/gi, "you")
    .replace(/[.!?]+$/, "")
    .trim();
  const words = reflected.split(/\s+/).filter(Boolean).slice(0, 7);
  if (words.length < 3) return null;
  return `I hear that ${words.join(" ")}.`;
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
      blueprintId: question.sourceBlueprintId ?? setup.personalizedBlueprint.id,
      stage: question.blueprintStage,
      topicKey: question.sourceTopicKey ?? question.topicKey,
      skillKeys: [...(question.skillKeys ?? [])],
      rubricKeys: [...(question.sourceRubricKeys ?? question.rubricKeys ?? [])],
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

export function rubricFor(setup: InterviewSetup, question: PlannedQuestion) {
  const rubricKeys = new Set(question.rubricKeys ?? []);
  if (setup.dsaBlockAssessment?.kind === "dsa-block-assessment") {
    if (!rubricKeys.size) return undefined;
    return BLOCK_ASSESSMENT_RUBRIC.filter((rubric) => rubricKeys.has(rubric.key));
  }
  const storyPracticeGuide =
    question.storyPracticeInterviewerGuide ??
    question.coreTechnicalInterviewerGuide ??
    question.technicalProjectInterviewerGuide;
  if (storyPracticeGuide) {
    const rubric = storyPracticeGuide.rubric;
    const total = rubric.reduce((sum, item) => sum + item.points, 0) || 1;
    return rubric.map((item, index) => ({
      key: `criterion-${index + 1}`,
      label: `Criterion ${index + 1}`,
      weightPercent: Math.round((item.points / total) * 100),
      strongSignals: [item.criterion],
      weakSignals: [`Does not establish: ${item.criterion}`]
    }));
  }
  if (!rubricKeys.size) return undefined;
  return setup.personalizedBlueprint?.rubric.filter((rubric) => rubricKeys.has(rubric.key));
}

const BLOCK_ASSESSMENT_RUBRIC = [
  {
    key: "pattern-recognition",
    label: "Pattern recognition",
    weightPercent: 20,
    strongSignals: ["Identifies the relevant DSA pattern and explains why it fits the inputs."],
    weakSignals: ["Selects a pattern without connecting it to the problem constraints."]
  },
  {
    key: "correctness-edge-cases",
    label: "Correctness and edge cases",
    weightPercent: 30,
    strongSignals: ["Produces results that pass the frozen tests and addresses boundary cases."],
    weakSignals: ["Has failing cases, unsupported assumptions, or misses boundary behavior."]
  },
  {
    key: "efficiency",
    label: "Time and space efficiency",
    weightPercent: 20,
    strongSignals: ["States and implements an appropriate time and space complexity trade-off."],
    weakSignals: ["Uses avoidable repeated work or cannot justify the complexity."]
  },
  {
    key: "code-quality",
    label: "Code quality",
    weightPercent: 15,
    strongSignals: ["Code is readable, structured, and uses data structures consistently."],
    weakSignals: ["Code is difficult to follow, fragile, or has avoidable implementation errors."]
  },
  {
    key: "communication",
    label: "Communication",
    weightPercent: 15,
    strongSignals: ["Explains the approach, invariants, and complexity clearly while coding."],
    weakSignals: ["Leaves reasoning, correctness, or complexity unexplained."]
  }
];

export function executionForEvaluation(
  state: InterviewState,
  questionIndex: number,
  answers: string[]
) {
  const execution = state.codeExecutions?.[String(questionIndex)] ?? null;
  if (state.setup.dsaBlockAssessment?.kind !== "dsa-block-assessment") return execution;
  const latest = answers.at(-1);
  return execution?.codeHash && latest && execution.codeHash === fencedCodeFingerprint(latest)
    ? execution
    : null;
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

function codingPresenceAcknowledgement(state: InterviewState): string {
  const priorAcknowledgements = state.turns.filter(
    (turn) =>
      turn.speaker === "agent" &&
      turn.questionIndex === state.questionIndex &&
      turn.action === "respond"
  ).length;
  const lines = [
    "I'm with you. Keep working through the idea—the clock is running, and you can submit when you're ready.",
    "Got it. Keep going, and use the run output to test the edge cases before you submit.",
    "Okay. Talk me through the next step if it helps, then submit once the code reflects your approach."
  ];
  return lines[priorAcknowledgements % lines.length]!;
}

function codeSubmissionAcknowledgement(state: InterviewState): string {
  const execution = state.codeExecutions?.[String(state.questionIndex)];
  if (!execution) {
    return "I can see your submitted code. There isn't a run result, so I'll review the implementation itself.";
  }
  if (execution.testCount > 0) {
    return `I can see your submitted code and the latest output: ${execution.testsPassed} of ${execution.testCount} tests passed.`;
  }
  if (execution.accepted) {
    return "I can see your submitted code and the latest output. It ran successfully.";
  }
  return "I can see your submitted code and the latest run output. Let's look at what it shows.";
}

function answerPayloadHash(answer: { text: string; startMs: number; endMs: number }): string {
  return createHash("sha256").update(answer.text).digest("hex");
}

/** A request to leave this question must never be interpreted as leaving the interview. */
export function candidateRequestsQuestionSkip(value: string): boolean {
  const normalized = value
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized || normalized.split(" ").length > 24) return false;

  return (
    /\b(?:move|go|skip|pass)(?: on)? to (?:the )?next (?:question|problem)\b/.test(normalized) ||
    /\b(?:skip|pass) (?:this|the current) (?:question|problem)\b/.test(normalized) ||
    /^(?:next|next question|next problem|move on)(?: please)?$/.test(normalized)
  );
}

/**
 * Ends only on an unambiguous withdrawal. Vague or weak interview answers such
 * as “I don't know” must continue through the normal conversational decider.
 */
export function candidateRequestsInterviewEnd(value: string): boolean {
  const normalized = value
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return false;

  const explicitMeetingEnd =
    /\b(?:end|stop|finish|quit|exit|cancel|leave|wrap up)\b(?:\s+(?:the|this|our))?\s+(?:interview|meeting|session|call)\b/.test(
      normalized
    ) ||
    /^(?:can|could|would) we (?:please )?(?:end|stop|finish|wrap up|call it)(?: here| now)?$/.test(
      normalized
    ) ||
    /^(?:let's|lets) (?:please )?(?:end|stop|finish|wrap up)(?: here| now)?$/.test(normalized) ||
    /^i (?:do not|don't|cannot|can't|won't) want to (?:continue|go on|do this)(?: anymore)?$/.test(
      normalized
    ) ||
    /^(?:james )?(?:please )?(?:end|stop|finish|quit|exit)(?: it| this)?(?: here| now)?$/.test(
      normalized
    ) ||
    /^i (?:want|would like|need) to (?:end|stop|finish|quit|leave)(?: the| this| our)?(?: interview|meeting|session|call)?(?: here| now)?$/.test(
      normalized
    );

  return explicitMeetingEnd;
}

/** Fatigue and reluctance need support and a choice, not an automatic exit. */
export function candidateNeedsInterviewBreak(value: string): boolean {
  const normalized = value
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized || normalized.split(" ").length > 14) return false;

  return (
    /^i (?:just )?(?:(?:want|need|would like) to|wanna) (?:sleep|go to sleep)(?: now)?$/.test(
      normalized
    ) ||
    /^i (?:just )?need (?:some )?sleep$/.test(normalized) ||
    /^i(?:'m| am) (?:too |really )?(?:tired|exhausted|sleepy)(?: to continue)?$/.test(normalized) ||
    /^i (?:do not|don't|cannot|can't|won't) want to (?:explain|talk)(?: anymore)?$/.test(normalized)
  );
}

/**
 * Recognises a refusal or explicit inability to answer a conversational
 * interview question. It intentionally rejects compound answers such as
 * “No, I did not add an index; I ran ANALYZE first.”
 */
export function candidateDeclinesQuestion(value: string): boolean {
  const normalized = value
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized || normalized.split(" ").length > 18) return false;

  if (/^(?:no|nope|nah|pass|skip)(?: thanks| thank you| please)?$/.test(normalized)) {
    return true;
  }

  // Remove conversational lead-ins only after preserving the full text above.
  // This lets “No, I don't want to answer this” match the same refusal as
  // “I don't want to answer this” without treating substantive “No, ...” answers as refusals.
  const withoutLeadIns = normalized.replace(
    /^(?:(?:well|actually|honestly|sorry)(?: thanks| thank you)?\s+){1,3}/,
    ""
  );
  const statement = withoutLeadIns.replace(
    /^(?:no|nope|nah)(?: thanks| thank you)?\s+(?=(?:i|nothing|not much)\b)/,
    ""
  );

  return (
    /^(?:i )?(?:do not|don't|cannot|can't|won't|will not) (?:answer|share|discuss|tell)(?: this| that| it| you)?(?: question)?(?: thanks| thank you| please)?$/.test(
      statement
    ) ||
    /^(?:i )?(?:do not|don't|won't|will not) want to (?:answer|share|discuss|talk about|tell you)(?: this| that| it)?(?: question)?$/.test(
      statement
    ) ||
    /^i(?:'m| am) not comfortable (?:answering|sharing|discussing|talking about)(?: this| that| it)?$/.test(
      statement
    ) ||
    /^i(?: prefer not to|(?:'d| would) rather not(?: to)?) (?:answer|share|discuss|talk about)(?: this| that| it)?$/.test(
      statement
    ) ||
    /^(?:i )?(?:do not|don't) know(?: the answer)?$/.test(statement) ||
    /^(?:i (?:have|got) )?(?:absolutely )?no (?:idea|clue)(?: about (?:this|that))?$/.test(
      statement
    ) ||
    /^(?:i )?(?:cannot|can't) (?:think of anything|remember|recall)(?: right now)?$/.test(
      statement
    ) ||
    /^(?:i )?(?:cannot|can't) (?:think of|figure out|come up with) (?:an? |the |any )?(?:solution|optimization|optimisation|better approach)(?: right now| further| anymore)?$/.test(
      statement
    ) ||
    /^(?:nothing|not much) (?:comes|is coming) to mind$/.test(statement) ||
    /^i(?:'m| am) not sure(?: about this| about that| of the answer)?$/.test(statement) ||
    /\bi (?:will not|won't) tell you\b/.test(statement)
  );
}

function consecutiveQuestionDeclines(state: InterviewState): number {
  let count = 0;
  for (let index = state.turns.length - 1; index >= 0; index -= 1) {
    const turn = state.turns[index];
    if (!turn || turn.speaker !== "user") continue;
    if (turn.skipped && turn.assessmentExcluded && typeof turn.questionIndex === "number") {
      count += 1;
      continue;
    }
    break;
  }
  return count;
}

function candidateEndUtterance(): string {
  return "Of course, we'll end the interview here. I'll save what we covered, and your feedback will be ready shortly.";
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

function isIncompleteBlockAssessment(state: InterviewState): boolean {
  return isResumableBlockAssessment(state.setup) && state.phase !== "done";
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function introUtterance(state: InterviewState): string {
  const first = state.plan[0];
  const minutes = Math.round(roundCaps(state.setup).hardCapMs / 60000);
  const storyPracticeIdentity = storyPracticeAssessmentIdentityFromSetup(state.setup);
  const interviewerName = interviewerNameForSetup(state.setup);
  const intro =
    state.setup.dsaBlockAssessment?.kind === "dsa-block-assessment"
      ? dsaBlockAssessmentOpening(state)
      : storyPracticeIdentity
        ? storyPracticeAssessmentOpening(
            state,
            storyPracticeAssessmentDialogue(storyPracticeIdentity.practice)
          )
        : isSystemDesignRound(state.setup) && !isDsaInterviewRound(state.setup)
          ? `Hi, I'm ${interviewerName}. Welcome to your System Design interview. I’ll give you an intentionally open-ended prompt. Start by clarifying the requirements, then build and evolve the architecture on the canvas as we go deeper.`
          : isDsaInterviewRound(state.setup)
            ? state.setup.dsaDesignRound?.kind === "dsa-design-round"
              ? `Hi, I'm ${interviewerName}. Welcome back to your legacy DSA and design interview. We'll start with coding, then continue into the frozen design scenario.`
              : `Hi, I'm ${interviewerName}. Welcome to your DSA interview. I picked two problems you've already solved in practice, and we'll talk through them like a real coding round. Take your time, explain your thinking, and I'll jump in when a follow-up is useful.`
            : isTechnicalProjectsRound(state.setup)
              ? `Hi, I'm ${interviewerName}. Welcome to your Core Technical and Projects interview. We'll start with three short technical decisions, then spend most of the round on one project from your experience. I may ask you to trace mechanisms, defend trade-offs, and pressure-test what happened in production. Let's begin.`
              : state.setup.fundamentalsRound
                ? `Hi, I'm ${interviewerName}. This is a computer fundamentals round, in three parts. A few quick checks first, then I'll ask you to explain the mechanism behind some of them, and we'll finish by diagnosing something real. After each answer I'll show you what I was listening for.`
                : isResumeRound(state.setup)
                  ? `Hi, I'm ${interviewerName}. Let's have a relaxed conversation about the work on your resume. I'll pick a few threads and ask about what actually happened, what you did, and what changed. Take your time.`
                  : `Hi, I'm ${interviewerName}, your Trailgrad interviewer. We'll spend about ${minutes} minutes on this ${state.setup.roundType.replace("-", " ")} conversation. I'll ask one question at a time, and you can pause to think.`;

  if (isResumableBlockAssessment(state.setup)) return intro;
  return first ? `${intro} ${candidateFacingQuestion(first, state.setup)}` : intro;
}

function candidateFacingQuestion(question: PlannedQuestion, setup: InterviewSetup): string {
  if (question.kind !== "code") return question.text;
  const interviewerName = interviewerNameForSetup(setup);
  return `${question.text} Use Run whenever you want to check the code. When you're ready, click Submit to ${interviewerName} and I'll review it.`;
}

export function closingDecision(): Decision {
  return {
    action: "move_on",
    missing: "none",
    reason: "interview complete",
    utterance:
      "We've reached the end of the interview, so we'll finish here. Thank you for your time.",
    forcedBy: null
  };
}
