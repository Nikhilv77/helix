import { z } from "zod";
import { AiService } from "../ai/ai.service";
import {
  describeLevel,
  describeRole,
  describeRound,
  levelFocus
} from "./prompt-context";
import { InterviewSetup, PlannedQuestion, QUESTION_COUNT } from "./types";

const plannedQuestionSchema = z.object({
  text: z.string().min(1),
  mustHit: z.array(z.string().min(1)).min(2).max(3),
  probeIfMissing: z.string().min(1)
});

const planSchema = z.object({
  questions: z.array(plannedQuestionSchema).min(1).max(6)
});

const SYSTEM_INSTRUCTION = `You design interview question sets. You return only JSON matching the requested schema.

You are writing questions for a real interviewer to read aloud. Every question must be answerable only by someone who has actually done the work described. Generic questions are a failure.`;

function buildPrompt(setup: InterviewSetup): string {
  return `Design a ${describeRound(setup.roundType)} interview for a ${describeLevel(setup.level)} interviewing as a ${describeRole(setup.role)}.

The candidate describes their experience as:
"""
${setup.context.trim()}
"""

Produce exactly ${QUESTION_COUNT} questions.

Constraints:
- At least 3 of the ${QUESTION_COUNT} must reference something specific the candidate mentioned. Use their own words for the system, product, or problem.
- Question 1 is the warm-up: answerable in about 60 seconds, still grounded in their context.
- No question may be answerable by someone who has not done the work.
- Banned openers: "tell me about yourself", "what is your greatest weakness", "why do you want this job".
- If the context is too thin to ground a question, ask about a decision they must have faced in this role at this level. Never ask trivia.
- ${levelFocus(setup.level)}

For each question return:
- text: the exact words the interviewer speaks. One sentence.
- mustHit: 2-3 things a complete answer contains. These are used to judge follow-ups.
- probeIfMissing: the single follow-up to ask if the answer skips the "how".`;
}

export class InterviewPlanner {
  constructor(private readonly ai: AiService) {}

  async plan(setup: InterviewSetup): Promise<PlannedQuestion[]> {
    const result = await this.ai.generateStructured({
      operation: "interview.plan",
      systemInstruction: SYSTEM_INSTRUCTION,
      prompt: buildPrompt(setup),
      schema: planSchema,
      modelClass: "fast",
      temperature: 0.6
    });

    return result.questions.slice(0, QUESTION_COUNT);
  }
}
