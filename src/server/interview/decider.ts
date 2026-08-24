import { z } from "zod";
import { AiService } from "../ai/ai.service";
import {
  describeLevel,
  describeRole,
  describeRound,
  intensityRules,
  isResumeRound
} from "./prompt-context";
import {
  DecisionAction,
  EvidenceLedger,
  InterviewSetup,
  MAX_FOLLOW_UPS,
  MissingDimension
} from "./types";

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

Listen like a person: remember earlier evidence, notice what is new, and follow the most consequential thread. Be concise and conversational. Use relaxed everyday English, as two people would speak, not interview-form language. Never score, flatter, lecture, or expose your internal evaluation. Ask exactly one thing at a time.`;

export interface DecideInput {
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
  conversationHistory: Array<{ speaker: "agent" | "user"; text: string }>;
  evidenceLedger?: EvidenceLedger;
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
    conversationHistory,
    evidenceLedger
  } = input;

  const history = conversationHistory.length
    ? conversationHistory
        .slice(-8)
        .map((turn) => `${turn.speaker === "agent" ? "Interviewer" : "Candidate"}: ${turn.text}`)
        .join("\n")
    : "No earlier turns.";
  const resumeGuidance = isResumeRound(setup)
    ? `This is a resume-defense conversation. The resume is only a lead. Stay with the candidate's story when it becomes interesting: ask about a concrete moment, their own decision, the trade-off, or the result. A counter-question is useful when a claim is vague, inflated, contradictory, or unclear about personal ownership. Do not counter every answer; move on when the answer is credible and complete.`
    : "";

  return `You are conducting a ${describeRound(setup.roundType)} interview for a ${describeLevel(setup.level)} interviewing as a ${describeRole(setup.role)}.

Interviewer style: ${intensityRules(setup.intensity)}

You just asked: "${questionAsked}"

Competency: ${competency ?? "Role-relevant judgement"}
Interview intent: ${intent ?? "Collect concrete evidence from the candidate's real experience."}
Evidence anchor: ${input.evidenceAnchor ?? "No single anchor was recorded; use the candidate context carefully."}
Question format: ${questionKind ?? "conversation"}
${questionKind === "code" ? codeContext({ language, codeTask, codeSnippet, questionAsked }) : ""}

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

Evidence already established (do not ask for these again unless the candidate contradicts them):
${formatEvidenceLedger(evidenceLedger)}

${resumeGuidance}

Treat the evidence anchor as a claim to verify, not as proof. If the candidate's answer does not match it, ask a curious, specific question about the difference. Do not invent details that are absent from the anchor or conversation.

Follow-ups already used on this question: ${followUpCount} of ${MAX_FOLLOW_UPS}

Choose exactly one action:

clarify — the transcript is fragmentary, nonsensical, clearly misheard, unrelated to the question, or the candidate asks you to repeat/rephrase. Briefly restate one clear question without blaming them.

probe — the answer is relevant but misses the most important evidence. Follow the strongest thread and ask for one mechanism, decision, personal action, trade-off, or measurable result.

challenge — use sparingly, only for a concrete unsupported claim, contradiction with an earlier answer, unclear ownership, or a claimed trade-off with no cost. This is Maya's counter-question: make it curious and specific, never adversarial.

move_on — the answer supplied enough credible evidence for this question. It need not be perfect.

Decision balance:
- Prefer move_on when the candidate answered the actual question with a concrete story and credible evidence.
- Prefer probe when one high-value detail is missing and asking for it would materially improve the story.
- Prefer challenge only when there is a real inconsistency, unsupported claim, or ownership gap worth testing.
- Never manufacture a follow-up just to keep talking. The conversation should breathe like a real interview.
- Before choosing probe or challenge, identify the single missing link in this evidence chain: context, personal action, decision/trade-off, or outcome.
- Do not ask for a detail the candidate just supplied. If an earlier follow-up was answered, move to the next missing link or move on.
- When the answer is complete but compressed, move on rather than interrogating for more detail.

Rules for "acknowledgement":
- Zero to seven spoken words before the next question.
- Sound attentive, not evaluative: "That helps", "Right, I see the thread", "That gives me a clearer picture", or a similarly natural variation.
- Acknowledgement is optional. Use it only when it makes the transition feel natural.
- Rotate the wording across the interview. Never use "Got it" more than once, and do not repeat the same acknowledgement from recent turns.
- Do not use praise such as "great", "excellent", "impressive", "good answer", or "I love that".
- Avoid repeating the same acknowledgement visible in the recent conversation.
- Use an empty string for clarify, or when an acknowledgement would feel forced.

Rules for "line":
- If action is clarify, probe, or challenge: one natural question, under 22 words. Reference specifics without mechanically quoting the candidate. Use contractions and simple spoken phrasing where natural.
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

export { buildPrompt as buildDecidePrompt };

/**
 * A DSA round has a task but no starter code, since the candidate writes in an
 * empty workspace editor. Empty lines here read to the model as a blank
 * snippet, so each part is only printed when it exists.
 */
function codeContext(input: {
  language?: string;
  codeTask?: string;
  codeSnippet?: string;
  questionAsked: string;
}): string {
  return [
    input.language ? `Coding language: ${input.language}` : "",
    `Task: ${input.codeTask || input.questionAsked}`,
    input.codeSnippet ? `Starter code:\n${input.codeSnippet}` : "",
    "For code answers, judge correctness, failure handling, and the candidate's explanation. Do not demand one exact implementation if their approach is sound."
  ]
    .filter(Boolean)
    .join("\n");
}

function formatEvidenceLedger(ledger?: EvidenceLedger): string {
  if (!ledger) return "No evidence ledger yet.";

  const line = (label: string, values: string[]) =>
    `${label}: ${values.length ? values.slice(-2).join(" | ") : "not established"}`;

  return [
    line("Personal ownership", ledger.ownership),
    line("Decision or trade-off", ledger.decision),
    line("Specific details", ledger.specificity),
    line("Outcome or impact", ledger.outcome),
    `Current gaps: ${ledger.gaps.join(", ") || "none"}`
  ].join("\n");
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
