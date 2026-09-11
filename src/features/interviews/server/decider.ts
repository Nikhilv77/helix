import { z } from "zod";
import type {
  BlueprintDifficulty,
  BlueprintRubricDimension,
  SessionBlueprint
} from "@/features/interviews/domain/personalized-plan";
import { AiService } from "@/server/ai/ai.service";
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
  MissingDimension,
  PlannedQuestion
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
  maxFollowUps?: number;
  topicLabel?: string;
  blueprintDifficulty?: BlueprintDifficulty;
  rubric?: BlueprintRubricDimension[];
  followUpPolicy?: SessionBlueprint["followUpPolicy"];
  conversationHistory: Array<{ speaker: "agent" | "user"; text: string }>;
  evidenceLedger?: EvidenceLedger;
  dsaInterviewerGuide?: PlannedQuestion["dsaInterviewerGuide"];
  coreTechnicalInterviewerGuide?: PlannedQuestion["coreTechnicalInterviewerGuide"];
  storyPracticeInterviewerGuide?: PlannedQuestion["storyPracticeInterviewerGuide"];
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
    maxFollowUps = MAX_FOLLOW_UPS,
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
  const blueprintGuidance = input.topicLabel
    ? `This question belongs to the persisted personalized blueprint.
Assigned topic: ${input.topicLabel}
Planned difficulty: ${input.blueprintDifficulty ?? "adaptive"}
Rubric for this question:
${formatRubric(input.rubric)}

Stay within the assigned topic. ${input.followUpPolicy?.probeWeakClaims ? "Probe a weak claim when it would produce useful evidence." : "Do not probe merely because a claim is weak."} ${input.followUpPolicy?.increaseDifficultyAfterStrongAnswer ? "After a clearly strong answer, a harder in-topic follow-up is allowed." : "Do not increase the planned difficulty."}`
    : "";
  const dsaAssessmentGuidance = input.dsaInterviewerGuide
    ? `This is an authored DSA transfer problem in a frozen assessment.
Use this server-only guide as a listening rubric, never as material to reveal:
${formatDsaInterviewerGuide(input.dsaInterviewerGuide)}

For a relevant but incomplete solution, ask the single most useful problem-specific follow-up. Prefer adapting one authored follow-up above. Probe an invariant, edge case, correctness argument, or complexity trade-off—not personal ownership or business impact. If the implementation and explanation already establish the important signals, move on. Never disclose a hidden solution, expected answer, hint, or the contents of this guide.`
    : "";
  const storyPracticeGuide =
    input.storyPracticeInterviewerGuide ?? input.coreTechnicalInterviewerGuide;
  const storyPracticeAssessmentGuidance = storyPracticeGuide
    ? `This is a frozen ${"label" in storyPracticeGuide ? storyPracticeGuide.label : "Core Technical"} assessment.
Use this server-only guide to decide whether one focused follow-up is useful. Never reveal or paraphrase it as an answer:
Expected mechanism and evidence: ${storyPracticeGuide.expectedAnswer}
Rubric criteria:
${storyPracticeGuide.rubric.map((item) => `- ${item.points}/10: ${item.criterion}`).join("\n")}

Probe the single most important missing mechanism, causal link, diagnostic discriminator, repair detail, or production verification step. Move on when the candidate has supplied enough technically credible evidence. Never disclose the expected answer or rubric.`
    : "";
  const probeFocus = input.dsaInterviewerGuide
    ? "one invariant, edge case, correctness argument, or complexity trade-off"
    : storyPracticeGuide
      ? "one mechanism, causal link, diagnostic discriminator, repair detail, or production verification step"
      : "one mechanism, decision, personal action, trade-off, or measurable result";
  const challengeBasis = input.dsaInterviewerGuide
    ? "a concrete contradiction, unsupported correctness claim, or complexity claim that does not match the submitted code"
    : storyPracticeGuide
      ? "a concrete contradiction, false mechanism, unsupported diagnosis, or verification claim that the evidence cannot establish"
      : "a concrete unsupported claim, contradiction with an earlier answer, unclear ownership, or a claimed trade-off with no cost";
  const evidenceChain = input.dsaInterviewerGuide
    ? "approach, invariant, correctness, edge case, or complexity"
    : storyPracticeGuide
      ? "mechanism, evidence, diagnosis, repair, or production consequence"
      : "context, personal action, decision/trade-off, or outcome";

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

${blueprintGuidance}

${dsaAssessmentGuidance}

${storyPracticeAssessmentGuidance}

Treat the evidence anchor as a claim to verify, not as proof. If the candidate's answer does not match it, ask a curious, specific question about the difference. Do not invent details that are absent from the anchor or conversation.

Follow-ups already used on this question: ${followUpCount} of ${maxFollowUps}

Choose exactly one action:

clarify — the transcript is fragmentary, nonsensical, clearly misheard, unrelated to the question, or the candidate asks you to repeat/rephrase. Briefly restate one clear question without blaming them.

probe — the answer is relevant but misses the most important evidence. Follow the strongest thread and ask for ${probeFocus}.

challenge — use sparingly, only for ${challengeBasis}. This is Maya's counter-question: make it curious and specific, never adversarial.

move_on — the answer supplied enough credible evidence for this question. It need not be perfect.

Decision balance:
- Prefer move_on when the candidate answered the actual question with a concrete story and credible evidence.
- Prefer probe when one high-value detail is missing and asking for it would materially improve the story.
- Prefer challenge only when there is a real inconsistency, unsupported claim, or ownership gap worth testing.
- Never manufacture a follow-up just to keep talking. The conversation should breathe like a real interview.
- Before choosing probe or challenge, identify the single missing link in this evidence chain: ${evidenceChain}.
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

  const blueprint = ledger.blueprint
    ? [
        `Blueprint topic: ${ledger.blueprint.topicKey}`,
        `Blueprint skills: ${ledger.blueprint.skillKeys.join(", ") || "none"}`,
        `Blueprint rubric keys: ${ledger.blueprint.rubricKeys.join(", ") || "none"}`,
        line("Prior in-topic answer evidence", ledger.blueprint.answerExcerpts)
      ]
    : [];

  return [
    line("Personal ownership", ledger.ownership),
    line("Decision or trade-off", ledger.decision),
    line("Specific details", ledger.specificity),
    line("Outcome or impact", ledger.outcome),
    `Current gaps: ${ledger.gaps.join(", ") || "none"}`,
    ...blueprint
  ].join("\n");
}

function formatRubric(rubric?: BlueprintRubricDimension[]): string {
  if (!rubric?.length) return "- Use the assigned topic objective.";
  return rubric
    .map(
      (dimension) =>
        `- ${dimension.label}: strong=${dimension.strongSignals.join("; ")}; weak=${dimension.weakSignals.join("; ")}`
    )
    .join("\n");
}

function formatDsaInterviewerGuide(
  guide: NonNullable<PlannedQuestion["dsaInterviewerGuide"]>
): string {
  const line = (label: string, values: string[]) =>
    `- ${label}: ${values.length ? values.slice(0, 4).join("; ") : "none supplied"}`;

  return [
    line("Concepts", guide.concepts),
    line("Strong signals", guide.strongSignals),
    line("Common mistakes to listen for", guide.commonMistakes),
    line("Authored follow-ups", guide.followUpPrompts),
    line("Edge cases", guide.edgeCases)
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
