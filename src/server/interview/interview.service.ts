import { randomUUID } from "node:crypto";
import { Logger } from "../common/logger";
import { BadRequestErrorException } from "../common/exceptions/bad-request-error.exception";
import { NotFoundErrorException } from "../common/exceptions/not-found-error.exception";
import { InterviewDecider, normaliseMissing } from "./decider";
import { InterviewPlanner } from "./planner";
import { SessionStore } from "./session-store";
import {
  advance,
  appendTurn,
  beginQuestioning,
  createState,
  currentQuestion,
  elapsedMs,
  finish
} from "./state-machine";
import { Decision, HARD_CAP_MS, InterviewSetup, InterviewState, QUESTION_COUNT } from "./types";

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
      mustHit: question.mustHit,
      userAnswer: answer.text,
      followUpCount: withAnswer.followUpCount,
      fallbackProbe: question.probeIfMissing
    });

    const result = advance(withAnswer, raw.action, now);
    const utterance = this.composeUtterance(result.state, result.action, raw.line);

    const spokenAt = elapsedMs(result.state, now);
    const withReply = appendTurn(result.state, {
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
    mustHit: string[];
    userAnswer: string;
    followUpCount: number;
    fallbackProbe: string;
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
    const bridge = line.trim();

    if (action !== "move_on") {
      return bridge.length > 0 ? bridge : "What was the outcome?";
    }

    if (state.phase === "wrap") {
      return joinSpoken(bridge, "That's all my questions. What would you like to ask me?");
    }

    const next = currentQuestion(state);
    if (!next) {
      return joinSpoken(bridge, "That's all my questions. What would you like to ask me?");
    }

    return joinSpoken(bridge, next.text);
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

function introUtterance(state: InterviewState): string {
  const first = state.plan[0];
  const minutes = Math.round(HARD_CAP_MS / 60000);
  const intro = `I'm Helix. I'll run your ${state.setup.roundType.replace("-", " ")} interview for about ${minutes} minutes. I'll ask ${QUESTION_COUNT} questions and may interrupt to keep us on time.`;

  return first ? `${intro} Let's start. ${first.text}` : intro;
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
