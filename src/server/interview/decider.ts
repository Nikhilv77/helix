import { z } from "zod";
import { AiService } from "../ai/ai.service";
import { describeLevel, describeRole, describeRound, intensityRules } from "./prompt-context";
import { DecisionAction, InterviewSetup, MAX_FOLLOW_UPS, MissingDimension } from "./types";

/**
 * Flat schema on purpose. A discriminated union serialises to `oneOf`, which
 * Gemini's structured output handles poorly, so the shape stays flat and the
 * caller narrows on `action`.
 *
 * `acknowledgement` and `line` remain separate so the application can append a
 * planned question without asking the model to rewrite it.
 */
const decisionSchema = z.object({
  action: z.enum(["clarify", "probe", "challenge", "move_on"]),
  missing: z.enum(["clarity", "structure", "specificity", "ownership", "outcome", "none"]),
  reason: z.string().min(1).max(200),
  acknowledgement: z.string().max(80),
  line: z.string().max(240)
});

export type RawDecision = z.infer<typeof decisionSchema>;

const SYSTEM_INSTRUCTION = `You are Maya, a perceptive senior interviewer conducting a live job interview. Return only JSON matching the requested schema.

Listen like a person: remember earlier evidence, notice what is new, and follow the most consequential thread. Be concise and conversational. Never score, flatter, lecture, or expose your internal evaluation. Ask exactly one thing at a time.`;

export interface DecideInput {
  setup: InterviewSetup;
  questionAsked: string;
  competency?: string;
  intent?: string;
  questionKind?: "conversation" | "code";
  language?: string;
  codeTask?: string;
  codeSnippet?: string;
  mustHit: string[];
  userAnswer: string;
  followUpCount: number;
  conversationHistory: Array<{ speaker: "agent" | "user"; text: string }>;
}

function buildPrompt(input: DecideInput): string {
  const {
    setup,
    questionAsked,
    competency,
    intent,
    questionKind,
    language,
    codeTask,
    codeSnippet,
    mustHit,
    userAnswer,
    followUpCount,
    conversationHistory
  } = input;

  const history = conversationHistory.length
    ? conversationHistory
        .slice(-8)
        .map((turn) => `${turn.speaker === "agent" ? "Interviewer" : "Candidate"}: ${turn.text}`)
        .join("\n")
    : "No earlier turns.";

  return `You are conducting a ${describeRound(setup.roundType)} interview for a ${describeLevel(setup.level)} interviewing as a ${describeRole(setup.role)}.

Interviewer style: ${intensityRules(setup.intensity)}

You just asked: "${questionAsked}"

Competency: ${competency ?? "Role-relevant judgement"}
Interview intent: ${intent ?? "Collect concrete evidence from the candidate's real experience."}
Question format: ${questionKind ?? "conversation"}
${
  questionKind === "code"
    ? `Coding language: ${language ?? "unspecified"}
Task: ${codeTask ?? questionAsked}
Starter code:
${codeSnippet ?? ""}
For code answers, judge correctness, failure handling, and the candidate's explanation. Do not demand one exact implementation if their approach is sound.`
    : ""
}

A complete answer contains:
${mustHit.map((item) => `- ${item}`).join("\n")}

The candidate answered:
"""
${userAnswer.trim()}
"""

Relevant conversation so far:
"""
${history}
"""

Follow-ups already used on this question: ${followUpCount} of ${MAX_FOLLOW_UPS}

Choose exactly one action:

clarify — the transcript is fragmentary, nonsensical, clearly misheard, unrelated to the question, or the candidate asks you to repeat/rephrase. Briefly restate one clear question without blaming them.

probe — the answer is relevant but misses the most important evidence. Follow the strongest thread and ask for one mechanism, decision, personal action, trade-off, or measurable result.

challenge — use sparingly, only for a concrete unsupported claim, contradiction with an earlier answer, unclear ownership, or a claimed trade-off with no cost. Turn skepticism into one professional question.

move_on — the answer supplied enough credible evidence for this question. It need not be perfect.

Rules for "acknowledgement":
- Zero to seven spoken words before the next question.
- Sound attentive, not evaluative: "Got it", "Okay", "That gives me the context", or a similarly natural variation.
- Do not use praise such as "great", "excellent", "impressive", "good answer", or "I love that".
- Avoid repeating the same acknowledgement visible in the recent conversation.
- Use an empty string for clarify, or when an acknowledgement would feel forced.

Rules for "line":
- If action is clarify, probe, or challenge: one natural question, under 22 words. Reference specifics without mechanically quoting the candidate.
- If action is move_on: an empty string. The next planned question is appended by the application.
- Never ask two questions, give advice, summarize the full answer, or say "can you elaborate" or "tell me more".

"missing" is clarity for clarify; otherwise whichever of structure, specificity, ownership, or outcome is weakest; use none when moving on.
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
  return value === "clarify" || value === "probe" || value === "challenge" || value === "move_on";
}

export function normaliseMissing(value: string): MissingDimension {
  switch (value) {
    case "clarity":
    case "structure":
    case "specificity":
    case "ownership":
    case "outcome":
      return value;
    default:
      return "none";
  }
}
