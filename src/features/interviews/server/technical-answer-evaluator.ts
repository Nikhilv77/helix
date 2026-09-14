import { z } from "zod";
import type { BlueprintRubricDimension } from "@/features/interviews/domain/personalized-plan";
import type {
  CodeExecutionEvidence,
  InterviewSetup,
  PlannedQuestion,
  QuestionEvaluation,
  TechnicalVerdict
} from "./types";
import type { AiService } from "@/server/ai/ai.service";
import type { AiCallTrace } from "@/server/ai/interfaces/system-designer-ai-provider.interface";
import { INTERVIEW_ENGINE_VERSION, INTERVIEW_EVALUATOR_PROMPT_VERSION } from "./runtime-version";
import { evaluationProfileForSetup } from "@/features/interviews/domain/evaluation-profile";

const evaluationSchema = z.object({
  // Keep the provider boundary tolerant and normalize below. Sparse answers
  // often make models return one extra gap or a decimal score; neither should
  // turn a valid judgement into an unavailable evaluation.
  score: z.number().min(0).max(100),
  verdict: z.enum([
    "correct",
    "mostly-correct",
    "partially-correct",
    "incorrect",
    "insufficient-evidence"
  ]),
  confidence: z.number().min(0).max(1),
  summary: z.string().min(1).max(600),
  strengths: z.array(z.string().min(1).max(300)).max(6),
  gaps: z.array(z.string().min(1).max(300)).max(6),
  rubricScores: z
    .array(
      z.object({
        rubricKey: z.string().trim().min(1).max(120),
        score: z.number().min(0).max(100),
        rationale: z.string().min(1).max(400)
      })
    )
    .max(12),
  evidenceQuotes: z.array(z.string().min(1).max(400)).max(4).optional()
});

type RawTechnicalEvaluation = z.infer<typeof evaluationSchema>;

export interface TechnicalAnswerEvaluationInput {
  setup: InterviewSetup;
  question: PlannedQuestion;
  answers: string[];
  rubric: BlueprintRubricDimension[];
  execution: CodeExecutionEvidence | null;
  evaluatedAt: number;
  /** Live-turn deadline propagated to the provider; never persisted. */
  signal?: AbortSignal;
}

const SYSTEM_INSTRUCTION = `You are a strict senior technical evaluator. Return only JSON matching the schema.

Judge factual and implementation correctness before clarity or confidence. A fluent, well-structured answer that contains a material technical error must score below a correct but less polished answer. Do not reward terminology by itself. Never invent missing evidence or claim code passed tests that were not provided.`;

const RESUME_SYSTEM_INSTRUCTION = `You are a thoughtful, fair interviewer reviewing a resume and behavioural answer. Return only JSON matching the schema.

Judge only what the candidate actually said. Do not reward confidence, length, buzzwords, or numbers without context. Do not invent achievements or personal ownership. Use short, plain English that a candidate can understand. If the answer lacks enough detail, say so clearly instead of guessing.`;

export class TechnicalAnswerEvaluator {
  constructor(private readonly ai: Pick<AiService, "generateStructured">) {}

  async evaluate(input: TechnicalAnswerEvaluationInput): Promise<QuestionEvaluation> {
    const calls: AiCallTrace[] = [];
    const startedAt = Date.now();
    const raw = await this.ai.generateStructured({
      operation: input.setup.resumeRound
        ? "interview.resume-answer.evaluate"
        : "interview.answer.evaluate",
      systemInstruction: input.setup.resumeRound ? RESUME_SYSTEM_INSTRUCTION : SYSTEM_INSTRUCTION,
      prompt: input.setup.resumeRound
        ? buildResumeAnswerEvaluationPrompt(input)
        : buildTechnicalEvaluationPrompt(input),
      schema: evaluationSchema,
      modelClass: "fast",
      temperature: 0.1,
      // A second Groq attempt used to finish after the live evaluator deadline
      // and overwrite the question with `evaluation-unavailable`. Fail over to
      // Gemini after one attempt while there is still latency budget left.
      maxAttempts: 1,
      signal: input.signal,
      onTrace: (trace) => calls.push(trace)
    });
    return {
      ...normalizeTechnicalEvaluation(raw, input),
      runtime: {
        engineVersion: INTERVIEW_ENGINE_VERSION,
        promptVersion: INTERVIEW_EVALUATOR_PROMPT_VERSION,
        durationMs: Date.now() - startedAt,
        recovered: false,
        calls
      }
    };
  }
}

export function shouldEvaluateTechnicalAnswer(
  setup: InterviewSetup,
  question: PlannedQuestion
): boolean {
  if (question.kind === "mcq") return false;
  if (question.topicKey?.startsWith("adaptive-behavioral-")) return false;
  // Every resume answer is scored from its evidence. This deliberately
  // replaces the old report-time keyword heuristic for career and behavioural
  // answers as well as technical resume claims.
  if (setup.resumeRound) return true;
  if (setup.fundamentalsRound) return question.stage === "explain" || question.stage === "scenario";
  if (setup.templateId === "dsa" || setup.templateTitle === "DSA practice interview") {
    return true;
  }
  return setup.roundType === "technical" || Boolean(setup.personalizedBlueprint);
}

/** Clear name for new callers; retained alias keeps existing callers stable. */
export const shouldEvaluateAnswer = shouldEvaluateTechnicalAnswer;

export function normalizeTechnicalEvaluation(
  raw: RawTechnicalEvaluation,
  input: TechnicalAnswerEvaluationInput
): QuestionEvaluation {
  const semanticScore = verdictBoundedScore(Math.round(raw.score), raw.verdict);
  const score = executionBoundedScore(semanticScore, raw.verdict, input.execution);
  const verdict = boundedVerdict(raw.verdict, score);
  const profile = evaluationProfileForSetup(input.setup);
  const rawRubricScores = new Map(
    uniqueBy(raw.rubricScores, (item) => item.rubricKey.trim().toLowerCase()).map((item) => [
      item.rubricKey.trim().toLowerCase(),
      item
    ])
  );

  return {
    source: "semantic-evaluator",
    score,
    verdict,
    confidence: Math.round(raw.confidence * 1_000) / 1_000,
    summary: truncate(raw.summary, 260),
    strengths: unique(raw.strengths)
      .slice(0, 3)
      .map((value) => truncate(value, 140)),
    gaps: unique(raw.gaps)
      .slice(0, 3)
      .map((value) => truncate(value, 140)),
    rubricScores: profile.parameters.map((parameter) => {
      const item = rawRubricScores.get(parameter.key);
      return {
        rubricKey: parameter.key,
        score: Math.round(item?.score ?? score),
        rationale: truncate(
          item?.rationale ??
            `The provider did not separate this parameter from the overall answer.`,
          180
        )
      };
    }),
    evidenceQuotes: groundedEvidenceQuotes(raw.evidenceQuotes ?? [], input.answers),
    answerExcerpts: input.answers
      .map((answer) => answer.replace(/\s+/g, " ").trim().slice(0, 240))
      .filter(Boolean)
      .slice(-3),
    execution: input.execution,
    evaluatedAt: input.evaluatedAt
  };
}

function groundedEvidenceQuotes(quotes: string[], answers: string[]): string[] {
  const evidence = answers.join(" ").replace(/\s+/g, " ").trim().toLowerCase();
  return unique(quotes)
    .filter((quote) => evidence.includes(quote.replace(/\s+/g, " ").trim().toLowerCase()))
    .slice(0, 2)
    .map((quote) => truncate(quote, 220));
}

function truncate(value: string, limit: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  const prefix = normalized.slice(0, limit - 1);
  const lastSpace = prefix.lastIndexOf(" ");
  return `${prefix.slice(0, lastSpace > limit / 2 ? lastSpace : prefix.length).trimEnd()}…`;
}

/**
 * Resume answers are judged like an interviewer would take notes: based on
 * personal ownership, judgement, useful detail, and what happened afterwards.
 * The model receives the immutable answer saved for the question, never a
 * summary generated for the report.
 */
export function buildResumeAnswerEvaluationPrompt(input: TechnicalAnswerEvaluationInput): string {
  const { setup, question, answers } = input;
  const profile = evaluationProfileForSetup(setup);

  return `Review this resume or behavioural interview answer fairly.

Target role: ${setup.role}
Candidate level: ${setup.level}
Interview type: ${setup.roundType === "hiring-manager" ? "Hiring manager and final behavioural" : "Resume and behavioural"}
Interview section: ${resumeSectionName(question.stage)}
Question: ${question.text}
Resume claim or topic: ${question.evidenceAnchor ?? question.competency ?? "Not specified"}
What this question was trying to learn: ${question.intent ?? "The candidate's real experience and judgement."}
Useful details to listen for:
${question.mustHit.map((item) => `- ${item}`).join("\n")}

Candidate's saved answer${answers.length > 1 ? "s" : ""}:
${answers.map((answer, index) => `Answer ${index + 1}:\n"""\n${answer.trim()}\n"""`).join("\n\n")}

This ${profile.label} session uses these six judgement parameters. Score every one from 0 to 100 using only supported evidence:
${formatEvaluationParameters(profile.parameters)}

Overall score guide:
- 85-100: clear, concrete, personal answer with strong evidence across the answer.
- 70-84: good answer with one meaningful missing detail.
- 45-69: some useful information, but important parts are vague or missing.
- 0-44: too vague, generic, off-topic, or unsupported to assess.

Return rubricScores with exactly these keys: ${profile.parameters.map((parameter) => parameter.key).join(", ")}.
For evidenceQuotes, copy up to two short exact phrases from the candidate's answer that support your judgement. If there is no useful quote, return an empty list.
Keep summary, strengths, gaps, and rationales short, specific, and human. Never say the candidate is good or bad as a person.`;
}

function resumeSectionName(stage: PlannedQuestion["stage"]): string {
  const labels: Record<NonNullable<PlannedQuestion["stage"]>, string> = {
    career: "Career story",
    "current-role": "Current role",
    project: "Project deep-dive",
    behavioral: "Behavioural evidence",
    experience: "Resume claim",
    skills: "Technical skill",
    code: "Coding exercise",
    rapid: "Quick check",
    explain: "Concept explanation",
    scenario: "Real-world scenario"
  };
  return labels[stage ?? "experience"];
}

export function buildTechnicalEvaluationPrompt(input: TechnicalAnswerEvaluationInput): string {
  const { setup, question, answers, rubric, execution } = input;
  const profile = evaluationProfileForSetup(setup);
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

  const storyPracticeGuide =
    question.storyPracticeInterviewerGuide ?? question.coreTechnicalInterviewerGuide;

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

${storyPracticeGuide ? `Authoritative expected mechanism and evidence (server-only):\n${storyPracticeGuide.expectedAnswer}` : ""}

Question-specific rubric (use it as supporting evidence inside the session parameters below):
${formatRubric(rubric)}

This ${profile.label} session uses these six judgement parameters:
${formatEvaluationParameters(profile.parameters)}

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

Return one overall score plus rubricScores with exactly these keys: ${profile.parameters.map((parameter) => parameter.key).join(", ")}.
Use up to two short evidenceQuotes copied exactly from the candidate's answer. The summary and gaps must identify concrete evidence, not writing style.`;
}

function formatEvaluationParameters(
  parameters: ReturnType<typeof evaluationProfileForSetup>["parameters"]
): string {
  return parameters.map((parameter) => `- ${parameter.key}: ${parameter.description}`).join("\n");
}

function formatRubric(rubric: BlueprintRubricDimension[]): string {
  if (!rubric.length)
    return "- technical-correctness: correct mechanism, constraints, and trade-offs";
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
