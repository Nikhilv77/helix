import { randomUUID } from "node:crypto";
import { Logger } from "../common/logger";
import { BadRequestErrorException } from "../common/exceptions/bad-request-error.exception";
import { NotFoundErrorException } from "../common/exceptions/not-found-error.exception";
import { InterviewDecider, normaliseMissing } from "./decider";
import { InterviewPlanner } from "./planner";
import { SessionStore } from "./session-store";
import { createHistoryItem, createInterviewReport, createWorkspaceInsights } from "./report";
import { createReportsOverview } from "./reports-overview";
import type { ReportsOverview } from "@/lib/reports";
import type { InterviewHistoryItem, InterviewReport, WorkspaceInsights } from "@/lib/types";
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
  Decision,
  DecisionAction,
  EvidenceDimension,
  EvidenceLedger,
  HARD_CAP_MS,
  InterviewSetup,
  InterviewState,
  MissingDimension
} from "./types";
import { isResumeRound } from "./prompt-context";

const DAY_MS = 24 * 60 * 60 * 1000;
/** A spoken conversation should never wait on the model's full provider timeout. */
const DECIDER_BUDGET_MS = 4_000;

export interface StartResult {
  state: InterviewState;
  utterance: string;
}

export interface AnswerResult {
  state: InterviewState;
  decision: Decision;
}

export class InterviewService {
  private readonly logger = new Logger(InterviewService.name);

  constructor(
    private readonly planner: InterviewPlanner,
    private readonly decider: InterviewDecider,
    private readonly store: SessionStore,
    /** Configurable so local iteration is not throttled by the product cap. */
    private readonly dailyLimit = 2
  ) {}

  async start(setup: InterviewSetup, ownerId: string, now = Date.now()): Promise<StartResult> {
    const used = await this.store.countStartedSince(ownerId, now - DAY_MS);
    if (used >= this.dailyLimit) {
      throw new BadRequestErrorException("SESSION_LIMIT_REACHED", "Daily session limit reached", {
        limit: this.dailyLimit,
        used
      });
    }

    const plan = await this.planner.plan(setup);
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

  async insights(ownerId: string, limit = 30, now = Date.now()): Promise<WorkspaceInsights> {
    const boundedLimit = Math.max(1, Math.min(limit, 50));
    return createWorkspaceInsights(await this.store.listByOwner(ownerId, boundedLimit), now);
  }

  /**
   * Every round this user has run, folded into the cross-round view. One store
   * read: the reports are built from the same sessions the history list uses,
   * so the index never disagrees with the rows it links to.
   */
  async reportsOverview(ownerId: string, limit = 50, now = Date.now()): Promise<ReportsOverview> {
    const boundedLimit = Math.max(1, Math.min(limit, 50));
    const sessions = await this.store.listByOwner(ownerId, boundedLimit);
    return createReportsOverview(
      sessions.map((session) => createInterviewReport(session, now)),
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

  async get(sessionId: string): Promise<InterviewState> {
    const state = await this.store.get(sessionId);
    if (!state) {
      throw new NotFoundErrorException("SESSION_NOT_FOUND", "Interview session not found", {
        sessionId
      });
    }
    return state;
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
    now = Date.now()
  ): Promise<AnswerResult> {
    const existing = await this.get(sessionId);

    if (existing.phase === "done") {
      throw new BadRequestErrorException("SESSION_COMPLETE", "This interview has ended", {
        sessionId
      });
    }

    const question = currentQuestion(existing);
    if (!question) {
      const closed = finish(existing);
      await this.store.save(closed);
      return { state: closed, decision: closingDecision() };
    }

    const withAnswer = appendTurn(existing, {
      speaker: "user",
      text: answer.text,
      startMs: answer.startMs,
      endMs: answer.endMs,
      questionIndex: existing.questionIndex
    });

    const raw = await this.decideWithFallback({
      setup: withAnswer.setup,
      questionAsked: question.text,
      evidenceAnchor: question.evidenceAnchor,
      competency: question.competency,
      intent: question.intent,
      questionKind: question.kind,
      language: question.language,
      codeTask: question.codeTask,
      codeSnippet: question.codeSnippet,
      mustHit: question.mustHit,
      userAnswer: answer.text,
      followUpCount: withAnswer.followUpCount,
      fallbackProbe: question.probeIfMissing,
      evidenceLedger: withAnswer.evidence?.[String(withAnswer.questionIndex)],
      conversationHistory: withAnswer.turns
        .slice(0, -1)
        .slice(-8)
        .map((turn) => ({ speaker: turn.speaker, text: turn.text.slice(0, 600) }))
    });

    const result = advance(withAnswer, raw.action, now);
    const questionEvidence = recordEvidence(
      withAnswer.evidence?.[String(withAnswer.questionIndex)],
      answer.text,
      raw.missing
    );
    const withEvidence = {
      ...result.state,
      evidence: {
        ...withAnswer.evidence,
        [String(withAnswer.questionIndex)]: questionEvidence
      }
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
    await this.store.save(finalState);

    const decision: Decision = {
      action: result.action,
      missing: normaliseMissing(raw.missing),
      reason: raw.reason,
      utterance,
      forcedBy: result.forcedBy
    };

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

    return { state: finalState, decision };
  }

  async end(sessionId: string): Promise<InterviewState> {
    const closed = finish(await this.get(sessionId));
    await this.store.save(closed);
    return closed;
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
    fallbackProbe: string;
    conversationHistory: Array<{ speaker: "agent" | "user"; text: string }>;
    evidenceLedger?: EvidenceLedger;
  }) {
    try {
      return await within(this.decider.decide(input), DECIDER_BUDGET_MS);
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: "interview.decide.fallback",
          reason: error instanceof Error ? error.name : "unknown"
        })
      );

      return {
        action: input.followUpCount >= 1 ? ("move_on" as const) : ("probe" as const),
        missing: "specificity",
        reason: "decider unavailable; used planned fallback",
        acknowledgement:
          input.followUpCount >= 1
            ? ["That helps", "Right, I see the thread", "That gives me a clearer picture"][
                input.followUpCount % 3
              ]
            : "",
        line: input.followUpCount >= 1 ? "" : input.fallbackProbe
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

async function within<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("Interview decider timed out")), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
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
  missing: string
): EvidenceLedger {
  const ledger: EvidenceLedger = current
    ? {
        ownership: [...current.ownership],
        decision: [...current.decision],
        specificity: [...current.specificity],
        outcome: [...current.outcome],
        gaps: [...current.gaps]
      }
    : {
        ownership: [],
        decision: [],
        specificity: [],
        outcome: [],
        gaps: ["ownership", "decision", "specificity", "outcome"]
      };
  const snippet = answer.replace(/\s+/g, " ").trim().slice(0, 240);
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

function introUtterance(state: InterviewState): string {
  const first = state.plan[0];
  const minutes = Math.round(HARD_CAP_MS / 60000);
  const intro =
    state.setup.templateTitle === "DSA practice interview"
      ? "Hi, I'm Maya. Welcome to your DSA interview. I picked a few problems you've already solved in practice, and we'll talk through them like a real coding round. Take your time, explain your thinking, and I'll jump in when a follow-up is useful."
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
