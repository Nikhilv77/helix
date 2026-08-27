import { z } from "zod";

import type { DsaQuestion } from "@/lib/dsa/dsa";
import { AiService } from "../ai/ai.service";
import type { HelpRequestContext } from "./help-request.types";

/**
 * What a helper reads before deciding whether to accept.
 *
 * Deliberately not a solution. A helper who is handed the fix reads it aloud,
 * the learner gets an answer instead of an explanation, and the summary becomes
 * a hint they never asked for — which is precisely the failure the "Ask
 * someone" escalation exists to avoid. The schema therefore has a field for the
 * gap and no field for the resolution.
 */
const stuckSummarySchema = z.object({
  /** One line a helper can scan in a notification. */
  headline: z.string().min(1).max(200),
  /** What the learner has already got right, so nobody re-explains it to them. */
  understands: z.array(z.string().min(1).max(120)).max(3),
  /** The specific gap — described, never resolved. */
  blockedOn: z.string().min(1).max(220),
  /** Sets helper expectations up front; accept rates depend on it. */
  estimatedMinutes: z.number().int().min(2).max(20),
  /** A question the helper might open with, to avoid a cold start. */
  opener: z.string().min(1).max(240)
});

export type StuckSummary = z.infer<typeof stuckSummarySchema>;

/**
 * The length budgets are stated here because they cannot be enforced anywhere
 * the model can see them: `toStrictJsonSchema` strips maxLength before the
 * request goes out, and the Zod parse only rejects an over-long field after the
 * fact. Without these numbers in the prompt the model writes to its own taste
 * and a long `opener` fails the whole call — which is exactly how this was
 * found.
 *
 * The name-the-symptom-not-the-cure rule is carried by worked examples rather
 * than by an abstract instruction. Told only "do not state the fix", the model
 * still returned "they forgot to update the node's position when accessed via
 * get", which is the entire answer in different words.
 */
export const SYSTEM_INSTRUCTION = `You brief a volunteer helper on where another engineer is stuck.

Your summary must leave the helper with something to explain. Name the symptom
and where it shows up — never the corrective action.

BAD (hands over the fix): "They forgot to move the node to the head on get."
BAD (same fix, reworded): "They aren't updating the node's position when it's accessed."
GOOD (symptom only): "Reads don't affect their eviction order — the test where a recently-read key should survive is the one failing."

BAD (too vague to act on): "Struggling with linked lists."
GOOD (specific, still unsolved): "Their put path maintains ordering but their get path doesn't, and they haven't connected that to the failing test."

Other rules:
- Credit what the learner already has right, so the helper does not re-explain it.
- Never mention or speculate about the learner's identity, ability, or intelligence.
- Return only JSON matching the schema.

Length budgets, strictly enforced — exceeding any of these fails the request:
- headline: at most 180 characters, one sentence.
- each item in understands: at most 110 characters. At most 3 items.
- blockedOn: at most 200 characters.
- opener: at most 220 characters.
- estimatedMinutes: a whole number between 2 and 20.`;

export class StuckSummaryService {
  constructor(private readonly ai: AiService) {}

  /**
   * Never throws. A summary is a nicety on top of a request that is already
   * open, so a model outage degrades to the deterministic fallback below rather
   * than failing the learner's ask.
   */
  async summarize(question: DsaQuestion, context: HelpRequestContext): Promise<StuckSummary> {
    try {
      return await this.ai.generateStructured({
        operation: "help.stuck.summarize",
        systemInstruction: SYSTEM_INSTRUCTION,
        prompt: buildStuckSummaryPrompt(question, context),
        schema: stuckSummarySchema,
        modelClass: "fast",
        // Low, not zero. The symptom-not-cure framing degrades as temperature
        // rises: at 0.3 roughly one summary in three drifted back into naming
        // the corrective action.
        temperature: 0.2
      });
    } catch {
      return fallbackSummary(question, context);
    }
  }
}

export function buildStuckSummaryPrompt(
  question: DsaQuestion,
  context: HelpRequestContext
): string {
  const language = context.code.trim() ? detectFenceLanguage(context) : "text";

  return `Brief a helper on where this engineer is stuck.

Problem: ${question.title} (${question.difficulty})
Statement: ${question.problemStatement ?? question.promptSummary}
Expected pattern: ${question.primaryPattern.replace(/-/g, " ")}
Target complexity: time ${question.complexity.time}, space ${question.complexity.space}

The intended approach, for your diagnosis only — do NOT repeat it in your answer:
${question.highLevelApproach}

Mistakes people commonly make here:
${bulletList(question.commonMistakes)}

--- Learner's current state ---
Time on this problem: ${formatDuration(context.timeSpentMs)}
AI hints already taken: ${context.hintsUsed}${context.hintsUsed >= 3 ? " (the AI explanation is not landing — that is why they want a human)" : ""}
Test result: ${describeTests(context)}

Their code:
\`\`\`${language}
${context.code.trim() || "// nothing written yet"}
\`\`\`

Test output:
"""
${context.testOutput?.trim() || "They have not run the tests."}
"""

Work out what they clearly already understand and what one thing is blocking
them. Estimate how many minutes a helper needs. Describe the blockage without
resolving it.`;
}

/**
 * Used when the model is unavailable. Says less, but says only true things: it
 * is assembled from the snapshot rather than inferred, so it can never invent a
 * blockage or leak a fix.
 */
export function fallbackSummary(
  question: DsaQuestion,
  context: HelpRequestContext
): StuckSummary {
  const tests = describeTests(context);

  return {
    headline: `Stuck on ${question.title} after ${formatDuration(context.timeSpentMs)}.`,
    understands: [],
    blockedOn: `No automatic summary was available. ${tests}. They had taken ${context.hintsUsed} AI ${context.hintsUsed === 1 ? "hint" : "hints"} before asking for a person.`,
    estimatedMinutes: Math.min(20, Math.max(5, question.expectedTimeMinutes >> 1)),
    opener: "Ask them to walk you through the approach they have so far."
  };
}

function describeTests(context: HelpRequestContext): string {
  if (context.failingTests === null) return "They have not run the tests yet";
  if (context.failingTests === 0) return "Tests pass, so the blockage is not correctness";
  return `${context.failingTests} ${context.failingTests === 1 ? "test is" : "tests are"} failing`;
}

function bulletList(items: string[]): string {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- None recorded";
}

/**
 * The snapshot records the language on the request, not inside the context, so
 * the fence falls back to a neutral hint rather than mislabelling the block.
 */
function detectFenceLanguage(context: HelpRequestContext): string {
  const code = context.code;
  if (/\bdef\s+\w+\s*\(|\bself\b/.test(code)) return "python";
  if (/\bpublic\s+(class|static)\b|\bSystem\.out\b/.test(code)) return "java";
  if (/\b(const|let|function|=>)\b/.test(code)) return "typescript";
  if (/#include\b|\bstd::/.test(code)) return "cpp";
  return "text";
}

export function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}
