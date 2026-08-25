import type {
  BlueprintRubricDimension,
  BlueprintStageKind,
  BlueprintTopic,
  QuestionFormat,
  SessionBlueprint
} from "@/lib/interviews/personalized-plan";
import type { InterviewSetup, PlannedQuestion } from "./types";

const MAX_RUNTIME_QUESTIONS = 8;

export interface PersonalizedQuestionSlot {
  index: number;
  stage: BlueprintStageKind;
  stagePurpose: string;
  format: QuestionFormat;
  topic: BlueprintTopic;
  objective: string;
  rubricKeys: string[];
  maxFollowUps: number;
}

/**
 * Expands a trusted session blueprint into the exact ordered slots the live
 * interviewer must fill. Weighted topics and rubrics are assigned with a
 * deterministic deficit scheduler so replaying a plan produces the same arc.
 */
export function personalizedQuestionSlots(
  blueprint: SessionBlueprint,
  requestedCount?: number
): PersonalizedQuestionSlot[] {
  const totalFromStructure = blueprint.structure.reduce(
    (total, stage) => total + stage.questionCount,
    0
  );
  const slotCount = Math.min(
    Math.max(1, requestedCount ?? totalFromStructure),
    totalFromStructure,
    MAX_RUNTIME_QUESTIONS
  );
  const topics = weightedSequence(blueprint.topics, (topic) => topic.targetPercent, slotCount);
  const rubrics = weightedSequence(blueprint.rubric, (rubric) => rubric.weightPercent, slotCount);
  const slots: PersonalizedQuestionSlot[] = [];

  for (const stage of blueprint.structure) {
    for (let stageIndex = 0; stageIndex < stage.questionCount; stageIndex += 1) {
      if (slots.length >= slotCount) return slots;
      const topic = topics[slots.length] ?? blueprint.topics[0];
      const rubric = rubrics[slots.length] ?? blueprint.rubric[0];
      if (!topic || !rubric) continue;

      slots.push({
        index: slots.length,
        stage: stage.kind,
        stagePurpose: stage.purpose,
        format: stage.formats[stageIndex % stage.formats.length] ?? "spoken",
        topic,
        objective: topic.objectives[stageIndex % topic.objectives.length] ?? topic.objectives[0]!,
        rubricKeys: [rubric.key],
        maxFollowUps: blueprint.followUpPolicy.maxPerQuestion
      });
    }
  }

  return slots;
}

export function buildPersonalizedBlueprintPrompt(setup: InterviewSetup): string {
  const blueprint = setup.personalizedBlueprint;
  if (!blueprint) throw new Error("A personalized blueprint is required");
  const slots = personalizedQuestionSlots(blueprint, setup.questionCount);

  return `Design the question plan for the persisted personalized interview blueprint below.

Session: ${blueprint.title}
Stable session type: ${blueprint.kind}
Difficulty: ${blueprint.difficulty}
Duration: ${blueprint.durationMinutes} minutes
Rationale: ${blueprint.rationale}

Candidate context:
"""
${setup.context.trim()}
"""

Allowed topics and target coverage:
${blueprint.topics
  .map((topic) => `- ${topic.label} (${topic.targetPercent}%): ${topic.objectives.join("; ")}`)
  .join("\n")}

Produce exactly ${slots.length} questions in this exact slot order:
${slots
  .map(
    (slot) =>
      `${slot.index + 1}. stage=${slot.stage}; topic=${slot.topic.label}; response=${slot.format}; objective=${slot.objective}; purpose=${slot.stagePurpose}`
  )
  .join("\n")}

Evaluation rubric:
${blueprint.rubric
  .map(
    (dimension) =>
      `- ${dimension.label} (${dimension.weightPercent}%): strong evidence includes ${dimension.strongSignals.join("; ")}; weak evidence includes ${dimension.weakSignals.join("; ")}`
  )
  .join("\n")}

Runtime follow-up policy:
- At most ${blueprint.followUpPolicy.maxPerQuestion} follow-ups per planned question.
- ${blueprint.followUpPolicy.probeWeakClaims ? "Probe weak or unsupported claims." : "Do not spend follow-ups probing weak claims."}
- ${blueprint.followUpPolicy.increaseDifficultyAfterStrongAnswer ? "Strong answers may earn a harder follow-up." : "Keep follow-ups at the planned difficulty."}
- Every question and follow-up must stay within the allowed topics above.

Constraints:
- Do not add, remove, merge, reorder, or rename slots.
- Each question must test its assigned topic, objective, stage purpose, and response format.
- Match the ${blueprint.difficulty} difficulty and the candidate's stated experience.
- Use one natural spoken sentence of at most 24 words, asking exactly one thing.
- Ground questions in the candidate context when evidence exists; never invent experience.
- A code slot asks for one concrete implementation or correction in the editor.
- A diagram slot asks the candidate to describe a design and data flow verbally.
- Avoid trivia and generic questions detached from the target role.
- Do not include Markdown, answer choices, solutions, or code in the question text.

For each question return:
- text: the exact words spoken.
- evidenceAnchor: the assigned topic plus the exact candidate claim or objective that motivated it.
- competency: the assigned rubric label or topic label.
- intent: the evidence this slot should reveal.
- mustHit: 2-3 observable signals drawn from the assigned objective and rubric.
- probeIfMissing: one short, in-topic fallback probe.`;
}

/** Stamps provider output with trusted slot metadata and presentation format. */
export function applyPersonalizedBlueprintFormats(
  setup: InterviewSetup,
  questions: PlannedQuestion[]
): PlannedQuestion[] {
  const blueprint = setup.personalizedBlueprint;
  if (!blueprint) return questions;
  const slots = personalizedQuestionSlots(blueprint, setup.questionCount);

  return slots.map((slot, index) => {
    const question = questions[index] ?? fallbackQuestionForSlot(blueprint, slot);
    const rubric = rubricForSlot(blueprint, slot);
    const base: PlannedQuestion = {
      ...question,
      competency: question.competency || rubric?.label || slot.topic.label,
      blueprintStage: slot.stage,
      blueprintDifficulty: blueprint.difficulty,
      blueprintFormat: slot.format,
      topicKey: slot.topic.key,
      skillKeys: [...slot.topic.skillKeys],
      rubricKeys: [...slot.rubricKeys],
      maxFollowUps: slot.maxFollowUps,
      kind: "conversation",
      answerFormat: answerFormatFor(slot.format),
      language: "",
      codeTask: "",
      codeSnippet: ""
    };

    if (slot.format !== "code") return base;
    return {
      ...base,
      kind: "code",
      answerFormat: "typed",
      language: languageFor(slot.topic.skillKeys),
      codeTask: `Implement a focused ${slot.topic.label} solution that demonstrates: ${slot.objective}`,
      codeSnippet: ""
    };
  });
}

export function createPersonalizedBlueprintFallback(setup: InterviewSetup): PlannedQuestion[] {
  const blueprint = setup.personalizedBlueprint;
  if (!blueprint) return [];
  const questions = personalizedQuestionSlots(blueprint, setup.questionCount).map((slot) =>
    fallbackQuestionForSlot(blueprint, slot)
  );
  return applyPersonalizedBlueprintFormats(setup, questions);
}

function fallbackQuestionForSlot(
  blueprint: SessionBlueprint,
  slot: PersonalizedQuestionSlot
): PlannedQuestion {
  const rubric = rubricForSlot(blueprint, slot);
  const text = fallbackQuestionText(slot);
  const strongSignals = rubric?.strongSignals.slice(0, 2) ?? [];

  return {
    text,
    evidenceAnchor: `${slot.topic.label}: ${slot.objective}`,
    competency: rubric?.label ?? slot.topic.label,
    intent: `Assess ${slot.objective.toLowerCase()} within the ${slot.stage} stage.`,
    mustHit:
      strongSignals.length >= 2
        ? strongSignals
        : [slot.objective, `a concrete ${slot.topic.label} trade-off`],
    probeIfMissing: fallbackProbe(slot, rubric),
    kind: "conversation",
    language: "",
    codeTask: "",
    codeSnippet: ""
  };
}

function fallbackQuestionText(slot: PersonalizedQuestionSlot): string {
  if (slot.format === "code") {
    return `Use the editor to implement a ${slot.topic.label} solution for this objective: ${slot.objective}`;
  }

  const questions: Record<BlueprintStageKind, string> = {
    "warm-up": `Where have you used ${slot.topic.label} to solve a concrete problem?`,
    core: `How does ${slot.topic.label} support this objective in practice: ${slot.objective}?`,
    scenario: `How would you handle a production failure while pursuing this ${slot.topic.label} objective?`,
    design: `Describe a ${slot.topic.label} design that meets this objective: ${slot.objective}.`,
    reflection: `What would you change about your previous ${slot.topic.label} approach now?`,
    mixed: `What decision best demonstrates your depth in ${slot.topic.label}?`
  };
  return questions[slot.stage];
}

function fallbackProbe(
  slot: PersonalizedQuestionSlot,
  rubric: BlueprintRubricDimension | undefined
): string {
  const signal = rubric?.strongSignals[0];
  if (signal) return `What concrete evidence shows that you ${lowercaseFirst(signal)}?`;
  return `Which ${slot.topic.label} trade-off mattered most?`;
}

function rubricForSlot(
  blueprint: SessionBlueprint,
  slot: PersonalizedQuestionSlot
): BlueprintRubricDimension | undefined {
  return blueprint.rubric.find((rubric) => slot.rubricKeys.includes(rubric.key));
}

function answerFormatFor(format: QuestionFormat): PlannedQuestion["answerFormat"] {
  if (format === "typed" || format === "mcq") return "typed";
  return "spoken";
}

function languageFor(skillKeys: string[]): string {
  const aliases: Record<string, string> = {
    typescript: "typescript",
    javascript: "javascript",
    python: "python",
    java: "java",
    php: "php",
    "c-sharp": "csharp",
    "c-plus-plus": "cpp",
    go: "go",
    rust: "rust",
    ruby: "ruby",
    kotlin: "kotlin",
    swift: "swift",
    sql: "sql",
    react: "tsx",
    nextjs: "tsx"
  };
  for (const key of skillKeys) {
    const language = aliases[key];
    if (language) return language;
  }
  return "typescript";
}

function weightedSequence<T>(values: T[], weight: (value: T) => number, count: number): T[] {
  if (!values.length || count <= 0) return [];
  const assigned = values.map(() => 0);
  const result: T[] = [];

  for (let position = 0; position < count; position += 1) {
    let selected = 0;
    let largestDeficit = Number.NEGATIVE_INFINITY;
    values.forEach((value, index) => {
      const deficit = (weight(value) / 100) * (position + 1) - (assigned[index] ?? 0);
      if (deficit > largestDeficit) {
        selected = index;
        largestDeficit = deficit;
      }
    });
    assigned[selected] = (assigned[selected] ?? 0) + 1;
    result.push(values[selected]!);
  }

  return result;
}

function lowercaseFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}
