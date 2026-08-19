import { z } from "zod";
import type { DsaQuestion } from "@/lib/dsa";
import { AiService } from "../ai/ai.service";

const evaluationSchema = z.object({
  verdict: z.enum(["strong", "developing", "needs-work"]),
  score: z.number().int().min(0).max(100),
  summary: z.string().min(1).max(220),
  strengths: z.array(z.string().min(1).max(120)).max(3),
  gaps: z.array(z.string().min(1).max(120)).max(3),
  followUp: z.string().min(1).max(180)
});

export type DsaInterviewEvaluation = z.infer<typeof evaluationSchema>;

export interface DsaInterviewSubmission {
  approach: string;
  code: string;
  timeComplexity: string;
  spaceComplexity: string;
  hintsUsed: number;
}

export class DsaInterviewEvaluator {
  constructor(private readonly ai: AiService) {}

  evaluate(
    question: DsaQuestion,
    submission: DsaInterviewSubmission
  ): Promise<DsaInterviewEvaluation> {
    return this.ai.generateStructured({
      operation: "dsa.interview.evaluate",
      systemInstruction:
        "You are a senior coding interviewer. Evaluate evidence, not writing style. Return only JSON matching the schema.",
      prompt: buildEvaluationPrompt(question, submission),
      schema: evaluationSchema,
      modelClass: "fast",
      temperature: 0.2
    });
  }
}

export function buildEvaluationPrompt(
  question: DsaQuestion,
  submission: DsaInterviewSubmission
): string {
  return `Evaluate this coding interview submission.

Problem: ${question.title}
Statement: ${question.problemStatement ?? question.promptSummary}
Expected pattern: ${question.primaryPattern.replace(/-/g, " ")}
Expected approach: ${question.highLevelApproach}
Expected complexity: time ${question.complexity.time}, space ${question.complexity.space}
Important edge cases:
${(question.edgeCases ?? []).map((item) => `- ${item}`).join("\n") || "- None recorded"}
Common mistakes:
${question.commonMistakes.map((item) => `- ${item}`).join("\n")}
Interview signals:
${question.interviewSignals.map((item) => `- ${item}`).join("\n")}

Candidate's spoken approach:
"""
${submission.approach.trim()}
"""

Candidate's code:
\`\`\`typescript
${submission.code.trim()}
\`\`\`

Claimed complexity: time ${submission.timeComplexity.trim()}, space ${submission.spaceComplexity.trim()}
Hints used: ${submission.hintsUsed}

Judge these dimensions together:
- Whether the approach matches the problem and maintains a valid invariant.
- Whether the code plausibly implements that approach and returns the required output.
- Whether important edge cases and common failure modes are handled.
- Whether the claimed time and space complexity match the code.
- Whether the candidate explained the reasoning clearly enough for an interviewer to follow.

Do not claim that code was executed. Mention uncertainty when correctness depends on missing tests or ambiguous input types.
The followUp must be one concise interviewer question targeting the highest-value gap. Do not ask multiple questions or say "got it".`;
}
