import type { Role } from "@/lib/shared/types";
import {
  BASELINE_SECTIONS,
  BASELINE_STAGE_BY_SECTION,
  baselineQuestion,
  firstBaselineSection,
  includesDsaPulse,
  nextBaselineSection,
  selectBaselineQuestionIds,
  type BaselineAnswer,
  type BaselineQuestion,
  type BaselineSection,
  type CandidateSkillProfile,
  type DsaStartingState,
  type PreparationOnboardingStage,
  type PreparationOnboardingState,
  type TopicFamiliarity
} from "@/lib/preparation/preparation-onboarding";

const STAGES = new Set<PreparationOnboardingStage>([
  "target_role", "target_level", "target_timeline", "preparation_areas", "target_company", "baseline_intro",
  "baseline_dsa_familiarity", "baseline_dsa_lookup", "baseline_dsa_binary_search", "baseline_dsa_tree_bfs", "baseline_dsa_adaptive", "baseline_dsa_code_lookup", "baseline_dsa_code_binary_search",
  "baseline_technical_1", "baseline_technical_2", "baseline_technical_3", "baseline_engineering", "baseline_architecture", "completed"
]);

const legacyStages: Record<string, PreparationOnboardingStage> = {
  baseline_coding: "baseline_dsa_familiarity",
  baseline_technical: "baseline_technical_1",
  baseline_reasoning: "baseline_engineering"
};

export function initialPreparationOnboardingState(now = Date.now()): PreparationOnboardingState {
  return { stage: "target_role", updatedAt: now, completedAt: null, baselineStartedAt: null, answers: {}, questionIds: {}, questions: {}, skillProfile: null };
}

/** Legacy records keep their target setup but restart the deliberately short new pulse. */
export function preparationOnboardingState(value: unknown): PreparationOnboardingState {
  if (!isRecord(value)) return initialPreparationOnboardingState();
  const storedStage = typeof value.stage === "string" ? value.stage : "";
  const stage = legacyStages[storedStage] ?? storedStage;
  if (!STAGES.has(stage as PreparationOnboardingStage)) return initialPreparationOnboardingState();
  return {
    stage: stage as PreparationOnboardingStage,
    updatedAt: number(value.updatedAt) ?? Date.now(),
    completedAt: nullableNumber(value.completedAt),
    baselineStartedAt: nullableNumber(value.baselineStartedAt),
    answers: answerMap(value.answers),
    questionIds: questionIds(value.questionIds),
    questions: questionMap(value.questions),
    skillProfile: skillProfile(value.skillProfile)
  };
}

/** Remove grading data before onboarding state crosses a server-to-client boundary. */
export function publicPreparationOnboardingState(value: unknown): PreparationOnboardingState {
  const state = preparationOnboardingState(value);
  const questions: PreparationOnboardingState["questions"] = {};
  for (const section of BASELINE_SECTIONS) {
    const question = state.questions[section];
    if (!question) continue;
    questions[section] = {
      section: question.section,
      eyebrow: question.eyebrow,
      title: question.title,
      prompt: question.prompt,
      options: question.options,
      code: question.code
    };
  }
  return { ...state, questions };
}

export function advancePreparationStage(state: PreparationOnboardingState, stage: PreparationOnboardingStage, now = Date.now()): PreparationOnboardingState {
  return { ...state, stage, updatedAt: now, baselineStartedAt: stage === "baseline_intro" || state.baselineStartedAt !== null ? state.baselineStartedAt : null };
}

export function startBaseline(state: PreparationOnboardingState, role: Role, ownerId: string, now = Date.now()): PreparationOnboardingState {
  const assignmentSeed = `${ownerId}:${now}`;
  const selectedQuestionIds = Object.keys(state.questionIds).length
    ? state.questionIds
    : selectBaselineQuestionIds(assignmentSeed, role);
  const questionIds = upgradeAiMlQuestionIds(selectedQuestionIds, role, state.answers);
  return {
    ...state,
    stage: BASELINE_STAGE_BY_SECTION[firstBaselineSection(role)],
    baselineStartedAt: state.baselineStartedAt ?? now,
    updatedAt: now,
    questionIds,
    questions: baselineQuestionSnapshots(role, questionIds, assignmentSeed)
  };
}

export function recordBaselineAnswer(
  state: PreparationOnboardingState,
  role: Role,
  section: BaselineSection,
  answer: BaselineAnswer,
  now = Date.now()
): PreparationOnboardingState {
  const answers = { ...state.answers, [section]: answer };
  const questionIds = upgradeAiMlQuestionIds(state.questionIds, role, state.answers, section);
  const nextSection = nextBaselineSection(section);
  const completed = nextSection === null;
  return {
    ...state,
    stage: completed ? "completed" : BASELINE_STAGE_BY_SECTION[nextSection],
    updatedAt: now,
    baselineStartedAt: state.baselineStartedAt ?? now,
    completedAt: completed ? now : null,
    answers,
    questionIds,
    skillProfile: completed ? buildInitialSkillProfile(role, answers, questionIds, state.questions, now) : null
  };
}

/**
 * AI/ML initially shared the Engineering and Architecture banks. Existing
 * in-progress records retain any answered item, but use the dedicated AI/ML
 * bank for a step they have not reached yet.
 */
function upgradeAiMlQuestionIds(
  questionIds: PreparationOnboardingState["questionIds"],
  role: Role,
  answers: PreparationOnboardingState["answers"],
  protectedSection?: BaselineSection
): PreparationOnboardingState["questionIds"] {
  if (role !== "ai-ml") return questionIds;
  const upgraded = { ...questionIds };
  const upgrade = (section: "engineering" | "architecture", prefix: "engineering" | "architecture") => {
    const existing = upgraded[section];
    if (!existing || answers[section] || protectedSection === section) return;
    const index = Number(existing.match(new RegExp(`^${prefix}-(\\d+)$`))?.[1]);
    if (Number.isInteger(index) && index >= 0) upgraded[section] = `ai-ml-${prefix}-${index % 50}`;
  };
  upgrade("engineering", "engineering");
  upgrade("architecture", "architecture");
  return upgraded;
}

function buildInitialSkillProfile(
  role: Role,
  answers: Partial<Record<BaselineSection, BaselineAnswer>>,
  questionIds: Partial<Record<BaselineSection, string>>,
  questions: PreparationOnboardingState["questions"],
  generatedAt: number
): CandidateSkillProfile {
  const topic = (section: "dsa-lookup" | "dsa-binary-search" | "dsa-tree-bfs" | "dsa-adaptive" | "dsa-code-lookup" | "dsa-code-binary-search"): TopicFamiliarity => {
    const answer = answers[section];
    if (!answer) return "unknown";
    return isCorrect(section, answer.choiceId, role, questionIds, questions) ? "familiar" : "needs-refresh";
  };
  const combinedTopic = (
    sections: Array<"dsa-lookup" | "dsa-binary-search" | "dsa-tree-bfs" | "dsa-adaptive" | "dsa-code-lookup" | "dsa-code-binary-search">
  ): TopicFamiliarity => {
    const results = sections.map((section) => topic(section));
    if (results.some((result) => result === "needs-refresh")) return "needs-refresh";
    return results.every((result) => result === "familiar") ? "familiar" : "unknown";
  };
  const technicalAnswers = (["technical-1", "technical-2", "technical-3"] as const)
    .map((section) => answers[section])
    .filter((answer): answer is BaselineAnswer => Boolean(answer));
  const technicalCorrect = technicalAnswers.filter((answer, index) =>
    isCorrect(([`technical-1`, `technical-2`, `technical-3`] as const)[index]!, answer.choiceId, role, questionIds, questions)
  ).length;
  const engineeringAnswer = answers.engineering;
  const engineeringFamiliarity: TopicFamiliarity = !engineeringAnswer
    ? "unknown"
    : isCorrect("engineering", engineeringAnswer.choiceId, role, questionIds, questions) ? "familiar" : "needs-refresh";
  const hasDsaEvidence = includesDsaPulse(role) && Boolean(answers["dsa-familiarity"]);

  return {
    source: "initial-baseline",
    generatedAt,
    signals: [
      hasDsaEvidence
        ? {
            areaId: "dsa", score: null, confidence: 0.34, evidence: "baseline" as const,
            startingState: dsaStartingState(answers, role, questionIds, questions),
            topics: [
              { label: "Arrays & Hashing", familiarity: topic("dsa-lookup") },
              { label: "Search patterns", familiarity: topic("dsa-binary-search") },
              { label: "Trees", familiarity: topic("dsa-tree-bfs") },
              { label: "Sliding Window", familiarity: topic("dsa-adaptive") },
              {
                label: "Code reading",
                familiarity: combinedTopic(["dsa-code-lookup", "dsa-code-binary-search"])
              },
              { label: "Dynamic Programming", familiarity: "unknown" as const }
            ]
          }
        : { areaId: "dsa", score: null, confidence: 0, evidence: "not-enough-evidence" as const },
      {
        areaId: "core-technical", score: null, confidence: technicalAnswers.length ? 0.32 : 0,
        evidence: technicalAnswers.length ? "baseline" : "not-enough-evidence",
        topics: [{ label: "Target-stack decisions", familiarity: technicalCorrect >= 2 ? "familiar" : "needs-refresh" }]
      },
      {
        areaId: "applied-engineering", score: null, confidence: engineeringAnswer ? 0.24 : 0,
        evidence: engineeringAnswer ? "baseline" : "not-enough-evidence",
        topics: [{ label: "Production reasoning", familiarity: engineeringFamiliarity }]
      },
      {
        areaId: "architecture-design", score: null, confidence: answers.architecture ? 0.2 : 0,
        evidence: answers.architecture ? "baseline" : "not-enough-evidence",
        topics: answers.architecture
          ? [{
              label: "System design judgment",
              familiarity: isCorrect("architecture", answers.architecture.choiceId, role, questionIds, questions)
                ? "familiar"
                : "needs-refresh"
            }]
          : undefined
      }
    ]
  };
}

function dsaStartingState(
  answers: Partial<Record<BaselineSection, BaselineAnswer>>,
  role: Role,
  questionIds: Partial<Record<BaselineSection, string>>,
  questions: PreparationOnboardingState["questions"]
): DsaStartingState {
  const familiarity = answers["dsa-familiarity"]?.choiceId;
  const correct = (["dsa-lookup", "dsa-binary-search", "dsa-tree-bfs", "dsa-adaptive", "dsa-code-lookup", "dsa-code-binary-search"] as const).filter((section) => {
    const answer = answers[section];
    return answer && isCorrect(section, answer.choiceId, role, questionIds, questions);
  }).length;
  if (!familiarity) return "unknown";
  // Objective checks set the outer bounds. Self-report only distinguishes the
  // middle band, so humility cannot erase strong evidence and confidence alone
  // cannot promote a weak result into the advanced path.
  if (correct >= 5) return "experienced-active";
  if (correct <= 2) return "needs-foundations";
  if (familiarity === "new" || familiarity === "some") return "some-familiarity";
  return "experienced-rusty";
}

function answerMap(value: unknown): Partial<Record<BaselineSection, BaselineAnswer>> {
  if (!isRecord(value)) return {};
  const answers: Partial<Record<BaselineSection, BaselineAnswer>> = {};
  for (const section of BASELINE_SECTIONS) {
    const answer = value[section];
    if (!isRecord(answer) || typeof answer.choiceId !== "string") continue;
    answers[section] = { choiceId: answer.choiceId, answeredAt: number(answer.answeredAt) ?? Date.now() };
  }
  return answers;
}

function questionIds(value: unknown): Partial<Record<BaselineSection, string>> {
  if (!isRecord(value)) return {};
  const result: Partial<Record<BaselineSection, string>> = {};
  for (const section of BASELINE_SECTIONS) {
    if (typeof value[section] === "string") result[section] = value[section];
  }
  return result;
}

function baselineQuestionSnapshots(
  role: Role,
  questionIds: PreparationOnboardingState["questionIds"],
  seed: string
): PreparationOnboardingState["questions"] {
  const questions: PreparationOnboardingState["questions"] = {};
  let section: BaselineSection | null = firstBaselineSection(role);
  while (section) {
    const assigned = baselineQuestion(section, role, questionIds[section]);
    const shuffledOptions = shuffleOptions(assigned.options, `${seed}:${section}`);
    const correctIndex = shuffledOptions.findIndex(
      (option) => option.id === assigned.correctOptionId
    );
    questions[section] = {
      ...assigned,
      options: shuffledOptions.map((option, index) => ({
        id: `choice-${index + 1}`,
        label: option.label
      })),
      correctOptionId: correctIndex >= 0 ? `choice-${correctIndex + 1}` : undefined
    };
    section = nextBaselineSection(section);
  }
  return questions;
}

function shuffleOptions<T>(items: T[], seed: string): T[] {
  const result = [...items];
  let state = hash(seed) || 1;
  for (let index = result.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const swapIndex = state % (index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
  }
  return result;
}

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  }
  return result >>> 0;
}

function isCorrect(
  section: BaselineSection,
  choiceId: string,
  role: Role,
  questionIds: Partial<Record<BaselineSection, string>>,
  questions: PreparationOnboardingState["questions"]
): boolean {
  const snapshot = questions[section];
  return (snapshot ?? baselineQuestion(section, role, questionIds[section])).correctOptionId === choiceId;
}

function questionMap(value: unknown): PreparationOnboardingState["questions"] {
  if (!isRecord(value)) return {};
  const questions: PreparationOnboardingState["questions"] = {};
  for (const section of BASELINE_SECTIONS) {
    const question = value[section];
    if (!isRecord(question) || typeof question.title !== "string" || typeof question.prompt !== "string" || !Array.isArray(question.options)) continue;
    const options = question.options.flatMap((option) =>
      isRecord(option) && typeof option.id === "string" && typeof option.label === "string"
        ? [{ id: option.id, label: option.label }]
        : []
    );
    if (!options.length) continue;
    const code = isRecord(question.code) && typeof question.code.value === "string" && typeof question.code.language === "string"
      ? { value: question.code.value, language: question.code.language }
      : undefined;
    questions[section] = {
      section,
      eyebrow: typeof question.eyebrow === "string" ? question.eyebrow : "",
      title: question.title,
      prompt: question.prompt,
      options,
      correctOptionId: typeof question.correctOptionId === "string" ? question.correctOptionId : undefined,
      code
    } satisfies BaselineQuestion;
  }
  return questions;
}

function skillProfile(value: unknown): CandidateSkillProfile | null {
  if (!isRecord(value) || value.source !== "initial-baseline" || !Array.isArray(value.signals)) return null;
  const signals = value.signals.flatMap((signal) => {
    if (!isRecord(signal) || typeof signal.areaId !== "string" || signal.score !== null || typeof signal.confidence !== "number") return [];
    if (signal.areaId !== "dsa" && signal.areaId !== "core-technical" && signal.areaId !== "applied-engineering" && signal.areaId !== "architecture-design") return [];
    if (signal.evidence !== "baseline" && signal.evidence !== "not-enough-evidence") return [];
    const startingState = signal.startingState === "experienced-active" || signal.startingState === "experienced-rusty" || signal.startingState === "some-familiarity" || signal.startingState === "needs-foundations" || signal.startingState === "unknown"
      ? signal.startingState
      : undefined;
    const topics = Array.isArray(signal.topics)
      ? signal.topics.flatMap((topic) => {
          if (!isRecord(topic) || typeof topic.label !== "string") return [];
          if (topic.familiarity !== "familiar" && topic.familiarity !== "needs-refresh" && topic.familiarity !== "unknown") return [];
          return [{ label: topic.label, familiarity: topic.familiarity }];
        })
      : undefined;
    return [{ areaId: signal.areaId, score: null, confidence: signal.confidence, evidence: signal.evidence, startingState, topics }];
  });
  if (signals.length !== 4) return null;
  return { source: "initial-baseline", generatedAt: number(value.generatedAt) ?? Date.now(), signals: signals as CandidateSkillProfile["signals"] };
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function number(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function nullableNumber(value: unknown): number | null { return value === null ? null : number(value); }
