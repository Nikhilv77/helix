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

/**
 * The model observes; code scores. It rates each targeted parameter on this
 * anchored five-point scale, the way an interviewer fills in a scorecard, and
 * the numbers below turn those ratings into the 0-100 scores the reports use.
 * The same answer and rating always produce the same score.
 */
export const EVIDENCE_LEVEL_SCORES = { 1: 10, 2: 30, 3: 55, 4: 78, 5: 94 } as const;
export type EvidenceLevel = keyof typeof EVIDENCE_LEVEL_SCORES;

const LEVEL_GUIDE = `Rate each parameter with a level from 1 to 5:
- 5: exceptional. Precise, complete, and credible; a senior interviewer would be impressed.
- 4: strong. Concrete and correct, with only minor omissions.
- 3: adequate. Credible, but one meaningful part is missing or thin.
- 2: weak. Vague, mostly unsupported, or with a material error.
- 1: absent. No usable evidence, refused, unrelated, or wrong at the core.
Most real answers are a 2, 3, or 4. Give a 5 only when nothing important is missing. A true but shallow answer is a 2, not a 1: keep 1 for answers that are wrong, refused, or say nothing relevant. Missing evidence for a targeted parameter is a low level, not a skipped one.`;

const evaluationSchema = z.object({
  // Keep the provider boundary tolerant and normalize below. Sparse answers
  // often make models return one extra gap or a decimal level; neither should
  // turn a valid judgement into an unavailable evaluation.
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
        /** 0 means the question did not ask for this parameter at all. */
        level: z.number().min(0).max(5),
        rationale: z.string().min(1).max(400),
        evidenceQuotes: z.array(z.string().min(1).max(400)).max(2).optional()
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

const RESUME_CODE_SYSTEM_INSTRUCTION = `You are a strict but fair senior engineer reviewing a resume-based coding exercise. Return only JSON matching the schema.

Judge the submitted implementation against the task. Treat successful execution without tests only as evidence that the program compiled and ran, not that it is correct. Do not score conversational filler such as requests for more time. Use short, specific explanations grounded in the submitted code.`;

/** Fixed so the same answer is rated the same way on every attempt. */
const EVALUATION_SEED = 11;

export class TechnicalAnswerEvaluator {
  constructor(
    private readonly ai: Pick<AiService, "generateStructured">,
    /**
     * Background grading has time for the reasoning model; the live path in
     * server-led rounds keeps the fast one.
     */
    private readonly modelClass: "fast" | "reasoning" = "fast"
  ) {}

  async evaluate(input: TechnicalAnswerEvaluationInput): Promise<QuestionEvaluation> {
    const calls: AiCallTrace[] = [];
    const startedAt = Date.now();
    const resumeCode = input.setup.resumeRound && input.question.kind === "code";
    const raw = await this.ai.generateStructured({
      operation: input.setup.resumeRound
        ? "interview.resume-answer.evaluate"
        : "interview.answer.evaluate",
      systemInstruction: resumeCode
        ? RESUME_CODE_SYSTEM_INSTRUCTION
        : input.setup.resumeRound
          ? RESUME_SYSTEM_INSTRUCTION
          : SYSTEM_INSTRUCTION,
      prompt: resumeCode
        ? buildResumeCodeEvaluationPrompt(input)
        : input.setup.resumeRound
          ? buildResumeAnswerEvaluationPrompt(input)
          : buildTechnicalEvaluationPrompt(input),
      schema: evaluationSchema,
      modelClass: this.modelClass,
      temperature: 0,
      seed: EVALUATION_SEED,
      // A second Groq attempt used to finish after the live evaluator deadline
      // and overwrite the question with `evaluation-unavailable`. Fail over to
      // Gemini after one attempt while there is still latency budget left.
      maxAttempts: 1,
      // Only reachable with a longer budget (block-assessment grading); the
      // live one-second deadline ends first.
      hedgeAfterMs: 5_000,
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

export function buildResumeCodeEvaluationPrompt(input: TechnicalAnswerEvaluationInput): string {
  const { setup, question } = input;
  const profile = evaluationProfileForSetup(setup);
  const targetedParameters = question.evaluationParameterKeys?.length
    ? profile.parameters.filter((parameter) =>
        question.evaluationParameterKeys?.includes(parameter.key)
      )
    : profile.parameters;
  const submittedAnswers = submittedCodeAnswers(input.answers);

  return `Evaluate this resume-based coding exercise fairly.

Target role: ${setup.role}
Candidate level: ${setup.level}
Task: ${question.codeTask || question.text}
Language: ${question.language || "not specified"}
Starter code (do not mistake this for completed candidate work):
${question.codeSnippet || "none"}

Candidate's submitted code and explanation:
${submittedAnswers.map((answer, index) => `Submission ${index + 1}:\n"""\n${answer.trim()}\n"""`).join("\n\n") || "No code submission was found."}

Execution evidence:
${formatExecutionEvidence(input.execution)}

Choose the verdict for the implementation as a whole:
- correct: correct and complete for the task, with sound handling of important edge cases.
- mostly-correct: minor omissions only.
- partially-correct: useful partial implementation with a material correctness gap.
- incorrect: wrong, placeholder-only, non-working, or too incomplete to meet the task.
- Successful execution with zero tests proves only that the submitted file ran.

Interpret the round parameters specifically for this coding exercise:
${formatEvaluationParameters(targetedParameters)}

${LEVEL_GUIDE}

Return rubricScores with exactly these keys and no others: ${targetedParameters.map((parameter) => parameter.key).join(", ")}.
Ground evidenceQuotes in the submitted code or explanation, never in the starter code or conversational filler.`;
}

function submittedCodeAnswers(answers: string[]): string[] {
  const submissions = answers.filter((answer) => /```[\s\S]*```/.test(answer));
  return submissions.length ? submissions : answers;
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
  const profile = evaluationProfileForSetup(input.setup);
  const targetedParameterKeys = new Set(
    input.question.evaluationParameterKeys?.length
      ? input.question.evaluationParameterKeys
      : profile.parameters.map((parameter) => parameter.key)
  );
  const rawRubricScores = new Map(
    uniqueBy(raw.rubricScores, (item) => item.rubricKey.trim().toLowerCase()).map((item) => [
      item.rubricKey.trim().toLowerCase(),
      item
    ])
  );
  // Level 0 marks a parameter the question never asked about; only questions
  // without a targeted parameter list may leave one out.
  const canSkip = !input.question.evaluationParameterKeys?.length;
  const targeted = profile.parameters.filter(
    (parameter) =>
      targetedParameterKeys.has(parameter.key) &&
      !(canSkip && rawRubricScores.get(parameter.key)?.level === 0)
  );
  // A parameter the model left out is judged from the ones it rated; with no
  // ratings at all, the correctness verdict stands in.
  const ratedLevels = targeted
    .map((parameter) => rawRubricScores.get(parameter.key)?.level)
    .filter((level): level is number => typeof level === "number" && level >= 1);
  const fallbackLevel = ratedLevels.length
    ? ratedLevels.reduce((total, level) => total + level, 0) / ratedLevels.length
    : VERDICT_LEVEL[raw.verdict];
  const parameterScores = targeted.map((parameter) => {
    const item = rawRubricScores.get(parameter.key);
    const level = item?.level && item.level >= 1 ? item.level : fallbackLevel;
    return { parameter, item, score: levelScore(level) };
  });
  const answerScore = parameterScores.length
    ? Math.round(
        parameterScores.reduce((total, entry) => total + entry.score, 0) / parameterScores.length
      )
    : levelScore(fallbackLevel);
  const semanticScore = verdictBoundedScore(answerScore, raw.verdict);
  const score = executionBoundedScore(semanticScore, raw.verdict, input.execution);
  const verdict = boundedVerdict(raw.verdict, score);
  const parameterCap = Math.min(
    verdictCeiling(raw.verdict),
    executionBoundedScore(100, raw.verdict, input.execution)
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
    rubricScores: parameterScores.map(({ parameter, item, score: parameterScore }) => {
      return {
        rubricKey: parameter.key,
        // The verdict and test results cap every parameter, so a clear
        // but wrong answer cannot score well through its other parameters.
        score: Math.min(parameterScore, parameterCap),
        rationale: truncate(
          item?.rationale ??
            `The provider did not separate this parameter from the overall answer.`,
          180
        ),
        evidenceQuotes: groundedEvidenceQuotes(item?.evidenceQuotes ?? [], input.answers)
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

/** Converts a (possibly fractional) level into its anchored score. */
export function levelScore(level: number): number {
  const clamped = Math.min(5, Math.max(1, level));
  const lower = Math.floor(clamped) as EvidenceLevel;
  const upper = Math.ceil(clamped) as EvidenceLevel;
  if (lower === upper) return EVIDENCE_LEVEL_SCORES[lower];
  const weight = clamped - lower;
  return Math.round(
    EVIDENCE_LEVEL_SCORES[lower] * (1 - weight) + EVIDENCE_LEVEL_SCORES[upper] * weight
  );
}

const VERDICT_LEVEL: Record<TechnicalVerdict, number> = {
  correct: 5,
  "mostly-correct": 4,
  "partially-correct": 3,
  "insufficient-evidence": 1,
  incorrect: 1
};

function verdictCeiling(verdict: TechnicalVerdict): number {
  if (verdict === "incorrect" || verdict === "insufficient-evidence") return 44;
  if (verdict === "partially-correct") return 69;
  if (verdict === "mostly-correct") return 84;
  return 100;
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
  const targetedParameters = question.evaluationParameterKeys?.length
    ? profile.parameters.filter((parameter) =>
        question.evaluationParameterKeys?.includes(parameter.key)
      )
    : profile.parameters;

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

This question intentionally assesses only the following ${profile.label} parameters. Rate each using only supported evidence:
${formatEvaluationParameters(targetedParameters)}

${LEVEL_GUIDE}

For the verdict, use correct for a fully credible answer, mostly-correct when only minor detail is missing, partially-correct when one meaningful part of the evidence chain is missing, insufficient-evidence when the answer is too thin to judge, and incorrect when it contradicts itself or the resume.

Return rubricScores with exactly these keys and no others: ${targetedParameters.map((parameter) => parameter.key).join(", ")}.
Do not rate parameters that this question does not target.
For every rubric level, include evidenceQuotes containing up to two short exact phrases from the candidate's answer that explain that specific score. A low level must cite the concerning phrase when one exists; when the problem is missing evidence, use an empty list and say exactly what was missing in the rationale.
For the top-level evidenceQuotes, copy up to two short exact phrases that best support the overall judgement.
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
    scenario: "Real-world scenario",
    "design-frame": "Requirements framing",
    "design-canvas": "Architecture design",
    "design-deep-dive": "Technical deep dive",
    "design-pressure": "Architecture pressure test",
    "design-defend": "Trade-off defence"
  };
  return labels[stage ?? "experience"];
}

export function buildTechnicalEvaluationPrompt(input: TechnicalAnswerEvaluationInput): string {
  const { setup, question, answers, rubric, execution } = input;
  const profile = evaluationProfileForSetup(setup);
  const executionEvidence = formatExecutionEvidence(execution);

  const storyPracticeGuide =
    question.storyPracticeInterviewerGuide ?? question.coreTechnicalInterviewerGuide;
  const technicalProjectGuide = question.technicalProjectInterviewerGuide;

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
${storyPracticeGuide && "practice" in storyPracticeGuide && storyPracticeGuide.practice === "architecture-design" ? "Treat the reference design as a grading rubric, not the only acceptable architecture. Accept a different coherent design when its assumptions are explicit and its trade-offs are technically defended." : ""}
${technicalProjectGuide ? `Grounded project evidence (server-only; treat it as source context, not a complete answer):\n${technicalProjectGuide.groundedFacts.map((fact) => `- ${fact}`).join("\n")}\nAllowed skill scope: ${technicalProjectGuide.allowedSkillKeys.join(", ") || "role-relevant engineering"}\nStrong signals: ${technicalProjectGuide.strongSignals.join("; ")}\nImportant checks: ${technicalProjectGuide.contradictionChecks.join("; ")}` : ""}

Question-specific rubric (use it as supporting evidence inside the session parameters below):
${formatRubric(rubric)}

This ${profile.label} session uses these six judgement parameters:
${formatEvaluationParameters(profile.parameters)}

${question.kind === "code" ? `Code task: ${question.codeTask || question.text}\nLanguage: ${question.language || "not specified"}\nStarter code: ${question.codeSnippet || "none"}` : ""}

Candidate answer evidence:
${answers.map((answer, index) => `Answer ${index + 1}:\n"""\n${answer.trim()}\n"""`).join("\n\n")}

Execution evidence:
${executionEvidence}

Verdict rules:
- correct: technically correct and complete for the assigned difficulty.
- mostly-correct: minor omissions do not break the central mechanism.
- partially-correct: useful understanding but at least one material gap.
- incorrect: wrong, contradictory, or non-working. A clear answer with a false central mechanism is incorrect, however fluent.
- insufficient-evidence: true as far as it goes but too thin to show the mechanism. Shallow is not the same as wrong.
- Passing all supplied tests is strong correctness evidence but does not prove quality, complexity, or completeness beyond those tests.
- Compilation or execution without tests is not proof of correctness.
- Failed supplied tests or compilation must be reflected in the verdict, levels, and gaps.

${LEVEL_GUIDE}

Return rubricScores with exactly these keys: ${profile.parameters.map((parameter) => parameter.key).join(", ")}.
If this question did not ask for evidence of a parameter at all (for example, project ownership on a pure concept question), give it level 0 instead of a low level. Never use 0 for evidence the question asked for but the candidate did not give.
Use up to two short evidenceQuotes copied exactly from the candidate's answer. The summary and gaps must identify concrete evidence, not writing style.`;
}

function formatExecutionEvidence(execution: CodeExecutionEvidence | null): string {
  return execution
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
