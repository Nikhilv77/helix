import { z } from "zod";
import type {
  AiMlStoryPath,
  AiMlStoryQuestion
} from "@/features/practice/ai-ml/domain/ai-ml-story-catalog";

/**
 * The assessment for a finished story-practice path. Four prompts are built
 * from the path's own authored content and frozen when it starts, mixing quick
 * taps with short written answers:
 *
 * 1. quick-check — the path's own multiple-choice question (graded instantly)
 * 2. explain     — the learner's weakest open question, in a few sentences
 * 3. follow-up   — one interviewer follow-up on another question
 * 4. trap        — pick the common mistake among correct statements (instant)
 *
 * Reference answers stay on the server; the room only sees prompts.
 */

export const STORY_ASSESSMENT_SCHEMA_VERSION = 2;
export const STORY_ASSESSMENT_MAX_ANSWER = 5_200;

const artifactSchema = z
  .object({
    kind: z.string(),
    title: z.string(),
    content: z.string(),
    language: z.string().optional(),
    caption: z.string().optional()
  })
  .passthrough();

const criterionSchema = z.object({ criterion: z.string(), points: z.number() });

export const storyAssessmentPromptSchema = z.object({
  // v2 ids first; v1 ids keep assessments started before 2026-09-27 readable.
  id: z.enum([
    "quick-check",
    "explain",
    "follow-up",
    "trap",
    "revisit",
    "follow-up-1",
    "follow-up-2",
    "mistake"
  ]),
  label: z.string(),
  prompt: z.string(),
  sourceQuestionId: z.string(),
  sourceTitle: z.string(),
  /** The practice question's own prompt, shown as context for the trap. */
  sourcePrompt: z.string().optional(),
  artifact: artifactSchema,
  /** Structure chips for the answer box; public. */
  guide: z.array(z.string()).max(4),
  /** Multiple-choice prompts are graded by matching the chosen option. */
  choices: z.array(z.string()).min(2).max(5).optional(),
  correctIndex: z.number().int().min(0).optional(),
  reference: z.object({ concise: z.string(), explanation: z.string() }),
  rubric: z.array(criterionSchema),
  commonMistakes: z.array(z.string()),
  interviewerFollowUps: z.array(z.string()),
  interviewConnection: z.string()
});
export type StoryAssessmentPrompt = z.infer<typeof storyAssessmentPromptSchema>;

export const storyAssessmentSnapshotSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(STORY_ASSESSMENT_SCHEMA_VERSION)]),
  pathTitle: z.string(),
  prompts: z.array(storyAssessmentPromptSchema).min(2).max(4)
});
export type StoryAssessmentSnapshot = z.infer<typeof storyAssessmentSnapshotSchema>;

export const storyAssessmentResponsesSchema = z.record(
  z.string(),
  z.string().max(STORY_ASSESSMENT_MAX_ANSWER)
);

export const storyAssessmentReportSchema = z.object({
  overallScore: z.number().min(0).max(100),
  prompts: z.array(
    z.object({
      promptId: z.string(),
      label: z.string(),
      score: z.number().min(0).max(100),
      result: z.string(),
      didWell: z.string(),
      missingOrIncorrect: z.string(),
      mechanism: z.string()
    })
  ),
  gradedAt: z.string()
});
export type StoryAssessmentReport = z.infer<typeof storyAssessmentReportSchema>;

/** How the learner did on each practice question; lower is weaker. */
export type StoryPathQuestionState = {
  questionKey: string;
  status: "ACTIVE" | "COMPLETED" | "LEARNED";
  /** 0–10 from the saved attempt, or null when there was none. */
  score: number | null;
};

const EXPLAIN_RUBRIC = [
  { criterion: "Give the correct answer or conclusion.", points: 4 },
  { criterion: "Explain why it happens, in plain words.", points: 3 },
  { criterion: "Name a fix, a check, or a consequence.", points: 3 }
];

const FOLLOW_UP_RUBRIC = [
  { criterion: "Answer the follow-up question directly and correctly.", points: 4 },
  { criterion: "Connect the answer to the reasoning from the original scenario.", points: 3 },
  { criterion: "Name a trade-off, a risk, or a way to verify the answer.", points: 3 }
];

const CHOICE_RUBRIC = [{ criterion: "Choose the correct option.", points: 10 }];

/** Open questions that read well as a short written answer, best first. */
const EXPLAIN_FORMAT_ORDER: AiMlStoryQuestion["format"][] = [
  "artifact-diagnosis",
  "production-decision",
  "written",
  "predict-explain"
];

export function buildStoryAssessmentSnapshot(
  path: AiMlStoryPath,
  states: readonly StoryPathQuestionState[]
): StoryAssessmentSnapshot {
  const stateByKey = new Map(states.map((state) => [state.questionKey, state]));
  const questions = path.questions;
  const order = (question: AiMlStoryQuestion) => questions.indexOf(question);
  const weakness = (question: AiMlStoryQuestion) => {
    const state = stateByKey.get(question.id);
    // Revealing the answer ("learned") counts as the weakest outcome.
    if (!state || state.status === "LEARNED") return 0;
    return state.score ?? 5;
  };

  const quick =
    questions.find((question) => question.format === "mcq" && question.choices?.length) ?? null;
  const open = questions.filter((question) => question.format !== "mcq");
  // An ordering question's prompt only makes sense beside its steps, so it is
  // never re-asked as a written prompt.
  const writable = open.filter((question) => !question.interaction);
  // The weakest open question; "predict the output" only when nothing else is left.
  const explain = [...(writable.length ? writable : open)].sort(
    (left, right) =>
      weakness(left) - weakness(right) ||
      EXPLAIN_FORMAT_ORDER.indexOf(left.format) - EXPLAIN_FORMAT_ORDER.indexOf(right.format) ||
      order(left) - order(right)
  )[0]!;
  const followUp =
    open.find(
      (question) => question.id !== explain.id && question.interviewerFollowUps.length > 0
    ) ?? explain;
  const used = new Set([quick?.id, explain.id, followUp.id]);
  const trapCandidates = questions.filter((question) => question.commonMistakes.length > 0);
  const trapSource =
    [...trapCandidates].sort(
      (left, right) =>
        Number(used.has(left.id)) - Number(used.has(right.id)) ||
        EXPLAIN_FORMAT_ORDER.indexOf(left.format) - EXPLAIN_FORMAT_ORDER.indexOf(right.format) ||
        order(left) - order(right)
    )[0] ?? explain;

  const prompts: StoryAssessmentPrompt[] = [];
  if (quick) {
    prompts.push({
      ...base(quick),
      id: "quick-check",
      label: "Quick check",
      prompt: quick.prompt,
      guide: [],
      choices: quick.choices!,
      correctIndex: quick.correctChoiceIndex ?? 0,
      rubric: CHOICE_RUBRIC
    });
  }
  prompts.push({
    ...base(explain),
    id: "explain",
    label: "Explain",
    prompt: `${explain.prompt} A few sentences is enough.`,
    guide: ["Answer", "Why it happens", "Fix or check"],
    rubric: EXPLAIN_RUBRIC
  });
  prompts.push({
    ...base(followUp),
    id: "follow-up",
    label: "Follow-up",
    prompt: `An interviewer follows up on “${followUp.title}”: ${followUp.interviewerFollowUps[0] ?? "What would you check first, and why?"}`,
    guide: ["Answer", "Why", "Trade-off"],
    rubric: FOLLOW_UP_RUBRIC
  });

  const trap = trapChoices(trapSource);
  if (trap) {
    prompts.push({
      ...base(trapSource),
      id: "trap",
      label: "Spot the trap",
      prompt: `In “${trapSource.title}”, two engineers give their answers. An interviewer would flag one of them as a mistake. Which one?`,
      sourcePrompt: trapSource.prompt,
      guide: [],
      choices: trap.choices,
      correctIndex: trap.correctIndex,
      reference: {
        concise: trapSource.commonMistakes[0]!,
        explanation: `That is the common mistake. The sound answer is: ${trapSource.answer.concise}`
      },
      rubric: CHOICE_RUBRIC
    });
  }

  return storyAssessmentSnapshotSchema.parse({
    schemaVersion: STORY_ASSESSMENT_SCHEMA_VERSION,
    pathTitle: path.title,
    prompts
  });
}

/**
 * The same scenario's sound answer beside its authored common mistake, so
 * both options are about the evidence shown next to them.
 */
function trapChoices(
  source: AiMlStoryQuestion
): { choices: string[]; correctIndex: number } | null {
  const mistake = source.commonMistakes[0]?.trim();
  const sound = source.answer.concise.trim();
  if (!mistake || !sound || mistake === sound) return null;
  const correctIndex = seed(source.id) % 2;
  return { choices: correctIndex === 0 ? [mistake, sound] : [sound, mistake], correctIndex };
}

function base(question: AiMlStoryQuestion) {
  return {
    sourceQuestionId: question.id,
    sourceTitle: question.title,
    artifact: question.artifact,
    reference: question.answer,
    commonMistakes: question.commonMistakes,
    interviewerFollowUps: question.interviewerFollowUps,
    interviewConnection: question.interviewConnection
  };
}

function seed(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}
