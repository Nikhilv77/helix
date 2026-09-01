import { z } from "zod";
import type { BlueprintRubricDimension } from "@/lib/interviews/personalized-plan";
import type {
  CodeExecutionEvidence,
  InterviewSetup,
  PlannedQuestion,
  QuestionEvaluation,
  TechnicalVerdict
} from "./types";
import { AiService } from "../ai/ai.service";

const evaluationSchema = z.object({
  score: z.number().int().min(0).max(100),
  verdict: z.enum([
    "correct",
    "mostly-correct",
    "partially-correct",
    "incorrect",
    "insufficient-evidence"
  ]),
  confidence: z.number().min(0).max(1),
  summary: z.string().min(1).max(260),
  strengths: z.array(z.string().min(1).max(140)).max(3),
  gaps: z.array(z.string().min(1).max(140)).max(3),
  rubricScores: z
    .array(
      z.object({
        rubricKey: z.string().trim().min(1).max(120),
        score: z.number().int().min(0).max(100),
        rationale: z.string().min(1).max(180)
      })
    )
    .max(5)
});

type RawTechnicalEvaluation = z.infer<typeof evaluationSchema>;

export interface TechnicalAnswerEvaluationInput {
  setup: InterviewSetup;
  question: PlannedQuestion;
  answers: string[];
  rubric: BlueprintRubricDimension[];
  execution: CodeExecutionEvidence | null;
  evaluatedAt: number;
}

const SYSTEM_INSTRUCTION = `You are a strict senior technical evaluator. Return only JSON matching the schema.

Judge factual and implementation correctness before clarity or confidence. A fluent, well-structured answer that contains a material technical error must score below a correct but less polished answer. Do not reward terminology by itself. Never invent missing evidence or claim code passed tests that were not provided.`;

export class TechnicalAnswerEvaluator {
  constructor(private readonly ai: AiService) {}

  async evaluate(input: TechnicalAnswerEvaluationInput): Promise<QuestionEvaluation> {
    const raw = await this.ai.generateStructured({
      operation: "interview.answer.evaluate",
      systemInstruction: SYSTEM_INSTRUCTION,
      prompt: buildTechnicalEvaluationPrompt(input),
      schema: evaluationSchema,
      modelClass: "fast",
      temperature: 0.1
    });
    return normalizeTechnicalEvaluation(raw, input);
  }
}

export function shouldEvaluateTechnicalAnswer(
  setup: InterviewSetup,
  question: PlannedQuestion
): boolean {
  if (question.kind === "mcq") return false;
  if (question.topicKey?.startsWith("adaptive-behavioral-")) return false;
  if (setup.resumeRound) return question.stage === "skills" || question.stage === "code";
  if (setup.fundamentalsRound) return question.stage === "explain" || question.stage === "scenario";
  if (
    setup.templateId === "dsa" ||
    setup.templateTitle === "DSA practice interview"
  ) {
    return true;
  }
  return setup.roundType === "technical" || Boolean(setup.personalizedBlueprint);
}

export function normalizeTechnicalEvaluation(
  raw: RawTechnicalEvaluation,
  input: TechnicalAnswerEvaluationInput
): QuestionEvaluation {
  const semanticScore = verdictBoundedScore(raw.score, raw.verdict);
  const score = executionBoundedScore(semanticScore, raw.verdict, input.execution);
  const verdict = boundedVerdict(raw.verdict, score);

  return {
    source: "semantic-evaluator",
    score,
    verdict,
    confidence: Math.round(raw.confidence * 1_000) / 1_000,
    summary: raw.summary.trim(),
    strengths: unique(raw.strengths),
    gaps: unique(raw.gaps),
    rubricScores: uniqueBy(raw.rubricScores, (item) => item.rubricKey).map((item) => ({
      ...item,
      rationale: item.rationale.trim()
    })),
    answerExcerpts: input.answers
      .map((answer) => answer.replace(/\s+/g, " ").trim().slice(0, 240))
      .filter(Boolean)
      .slice(-3),
    execution: input.execution,
    evaluatedAt: input.evaluatedAt
  };
}

export function buildTechnicalEvaluationPrompt(input: TechnicalAnswerEvaluationInput): string {
  const { setup, question, answers, rubric, execution } = input;
  const executionEvidence = execution
    ? [
        `Status: ${execution.status}`,
        `Execution accepted: ${execution.accepted ? "yes" : "no"}`,
        execution.testCount
          ? `Tests: ${execution.testsPassed}/${execution.testCount} passed`
          : "Tests: none supplied; successful execution proves only that the program ran",
        execution.compileOutput ? `Compiler output: ${execution.compileOutput}` : "",
        execution.stderr ? `Runtime error output: ${execution.stderr}` : ""
      ]
        .filter(Boolean)
        .join("\n")
    : "No execution evidence was recorded. Judge code semantically and state uncertainty.";

  return `Evaluate the candidate's cumulative answer to one interview question.

Target role: ${setup.role}
Candidate level: ${setup.level}
Question: ${question.text}
Question type: ${question.kind ?? "conversation"}
Assigned topic: ${question.topicKey ?? question.competency ?? "role-relevant technical judgement"}
Planned difficulty: ${question.blueprintDifficulty ?? "not specified"}
Intent: ${question.intent ?? "Assess technically correct reasoning."}
Expected evidence:
${question.mustHit.map((item) => `- ${item}`).join("\n")}

Rubric:
${formatRubric(rubric)}

${question.kind === "code" ? `Code task: ${question.codeTask || question.text}\nLanguage: ${question.language || "not specified"}\nStarter code: ${question.codeSnippet || "none"}` : ""}

Candidate answer evidence:
${answers.map((answer, index) => `Answer ${index + 1}:\n"""\n${answer.trim()}\n"""`).join("\n\n")}

Execution evidence:
${executionEvidence}

Scoring rules:
- 85-100: technically correct and complete for the assigned difficulty.
- 70-84: mostly correct; minor omissions do not break the central mechanism.
- 45-69: partially correct; useful understanding but at least one material gap.
- 0-44: incorrect, contradictory, non-working, or too incomplete to support the claim.
- A clear answer with a false central mechanism belongs below 45.
- Passing all supplied tests is strong correctness evidence but does not prove quality, complexity, or completeness beyond those tests.
- Compilation or execution without tests is not proof of correctness.
- Failed supplied tests or compilation must be reflected in the score and gaps.

Return one overall score plus rubric-specific scores. The summary and gaps must identify concrete technical evidence, not writing style.`;
}

function formatRubric(rubric: BlueprintRubricDimension[]): string {
  if (!rubric.length) return "- technical-correctness: correct mechanism, constraints, and trade-offs";
  return rubric
    .map(
      (dimension) =>
        `- ${dimension.key}: strong=${dimension.strongSignals.join("; ")}; weak=${dimension.weakSignals.join("; ")}`
    )
    .join("\n");
}

function verdictBoundedScore(score: number, verdict: TechnicalVerdict): number {
  if (verdict === "incorrect" || verdict === "insufficient-evidence") {
    return Math.min(score, 44);
  }
  if (verdict === "partially-correct") return Math.min(score, 69);
  if (verdict === "mostly-correct") return Math.min(score, 84);
  return score;
}

function executionBoundedScore(
  score: number,
  verdict: TechnicalVerdict,
  execution: CodeExecutionEvidence | null
): number {
  if (!execution) return score;
  if (execution.testCount > 0) {
    const ratio = execution.testsPassed / execution.testCount;
    if (
      ratio === 1 &&
      execution.accepted &&
      (verdict === "correct" || verdict === "mostly-correct")
    ) {
      return Math.max(70, score);
    }
    const cap = Math.round(25 + ratio * 55);
    return Math.min(score, cap);
  }
  if (!execution.accepted) return Math.min(score, 25);
  return score;
}

function boundedVerdict(verdict: TechnicalVerdict, score: number): TechnicalVerdict {
  if (verdict === "insufficient-evidence" && score < 45) return verdict;
  if (score >= 85) return "correct";
  if (score >= 70) return "mostly-correct";
  if (score >= 45) return "partially-correct";
  return "incorrect";
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function uniqueBy<T>(values: T[], keyFor: (value: T) => string): T[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = keyFor(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
