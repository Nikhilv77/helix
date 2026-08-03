import { z } from "zod";
import { AiService } from "../ai/ai.service";
import { describeLevel, describeRole, describeRound, intensityRules } from "./prompt-context";
import { DecisionAction, InterviewSetup, MAX_FOLLOW_UPS, MissingDimension } from "./types";

/**
 * Flat schema on purpose. A discriminated union serialises to `oneOf`, which
 * Gemini's structured output handles poorly, so the shape stays flat and the
 * caller narrows on `action`.
 *
 * `line` is what the model writes. For probe/challenge it is the whole spoken
 * utterance; for move_on it is only a short bridge clause and the caller
 * appends the planned question verbatim.
 */
const decisionSchema = z.object({
  action: z.enum(["probe", "challenge", "move_on"]),
  missing: z.enum(["structure", "specificity", "ownership", "outcome", "none"]),
  reason: z.string().min(1).max(200),
  line: z.string().max(240)
});

export type RawDecision = z.infer<typeof decisionSchema>;

const SYSTEM_INSTRUCTION = `You are conducting a job interview. You return only JSON matching the requested schema.

You never evaluate the candidate out loud. You never compliment. You ask one thing at a time.`;

export interface DecideInput {
  setup: InterviewSetup;
  questionAsked: string;
  mustHit: string[];
  userAnswer: string;
  followUpCount: number;
}

function buildPrompt(input: DecideInput): string {
  const { setup, questionAsked, mustHit, userAnswer, followUpCount } = input;

  return `You are conducting a ${describeRound(setup.roundType)} interview for a ${describeLevel(setup.level)} interviewing as a ${describeRole(setup.role)}.

Interviewer style: ${intensityRules(setup.intensity)}

You just asked: "${questionAsked}"

A complete answer contains:
${mustHit.map((item) => `- ${item}`).join("\n")}

The candidate answered:
"""
${userAnswer.trim()}
"""

Follow-ups already used on this question: ${followUpCount} of ${MAX_FOLLOW_UPS}

Choose exactly one action:

probe — the answer described WHAT happened but not HOW they did it, or it stayed at a level of generality where any candidate could have said the same thing. Ask for the specific mechanism, decision, or number that is missing.

challenge — the answer contains a claim that does not hold up: an unsupported result, credit taken for work described as the team's, a trade-off asserted without its cost, or a contradiction with something said earlier. Name the specific hole.

move_on — the answer covered the must-hit criteria with concrete detail.

Rules for "line":
- If action is probe or challenge: one sentence, under 25 words, spoken aloud. Quote or reference a specific phrase from their answer. Never write "can you elaborate" or "tell me more".
- If action is move_on: a bridge clause of at most 8 words, or an empty string. Do NOT write the next question — it is appended for you.
- Never compliment or evaluate out loud.

"missing" is whichever of structure, specificity, ownership, or outcome was weakest, or "none" when moving on.
"reason" is one clause explaining your choice. It is never spoken.`;
}

export class InterviewDecider {
  constructor(private readonly ai: AiService) {}

  async decide(input: DecideInput): Promise<RawDecision> {
    return this.ai.generateStructured({
      operation: "interview.decide",
      systemInstruction: SYSTEM_INSTRUCTION,
      prompt: buildPrompt(input),
      schema: decisionSchema,
      // Gemini Flash: this runs on every turn and sits in the latency path.
      modelClass: "fast",
      temperature: 0.3
    });
  }
}

export function isDecisionAction(value: string): value is DecisionAction {
  return value === "probe" || value === "challenge" || value === "move_on";
}

export function normaliseMissing(value: string): MissingDimension {
  switch (value) {
    case "structure":
    case "specificity":
    case "ownership":
    case "outcome":
      return value;
    default:
      return "none";
  }
}
