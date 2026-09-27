/**
 * A short, unscored recall check shown beside a written assessment question.
 * Built only from practice content the learner has already finished, and never
 * from the practice questions an assessment prompt is graded against.
 */
export type RecallQuizItem = {
  id: string;
  prompt: string;
  /** What to do with the prompt, shown beneath it. */
  instruction: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  /** Where the item came from, e.g. "Practice question 3". */
  source: string;
};

export type RecallQuizSource = {
  id: string;
  order: number;
  prompt: string;
  /** The question's own options, when it was a multiple-choice question. */
  choices?: string[];
  correctChoiceIndex?: number;
  concise: string;
  explanation: string;
};

const MAX_ITEMS = 4;
const MIN_ITEMS = 2;

export function buildRecallQuiz(
  sources: readonly RecallQuizSource[],
  excludedIds: ReadonlySet<string>
): RecallQuizItem[] {
  const eligible = [...sources]
    .filter((source) => !excludedIds.has(source.id) && source.concise.trim())
    .sort((left, right) => left.order - right.order);

  const items: RecallQuizItem[] = [];
  for (const source of eligible) {
    const own = ownChoiceItem(source);
    if (own) {
      items.push(own);
      continue;
    }
    // Wrong choices are the answers to other finished questions from the same
    // path: plausible, on topic, and still clearly answers to something else.
    const others = eligible.filter(
      (other) => other.id !== source.id && other.concise.trim() !== source.concise.trim()
    );
    if (others.length < 2) continue;
    const start = seed(source.id) % others.length;
    const distractors = [others[start]!, others[(start + 1) % others.length]!].map(
      (other) => other.concise.trim()
    );
    const choices = rotate([source.concise.trim(), ...distractors], seed(`${source.id}:order`));
    items.push({
      id: source.id,
      prompt: shorten(source.prompt, 240),
      instruction: "Which of these was the answer to this question?",
      choices,
      correctIndex: choices.indexOf(source.concise.trim()),
      explanation: shorten(firstSentences(source.explanation), 260),
      source: `Practice question ${source.order}`
    });
  }

  const quiz = items.slice(0, MAX_ITEMS);
  return quiz.length >= MIN_ITEMS ? quiz : [];
}

function ownChoiceItem(source: RecallQuizSource): RecallQuizItem | null {
  const { choices, correctChoiceIndex } = source;
  if (!choices?.length || correctChoiceIndex === undefined || !choices[correctChoiceIndex]) {
    return null;
  }
  return {
    id: source.id,
    prompt: shorten(source.prompt, 260),
    instruction: "Choose the best answer.",
    choices: [...choices],
    correctIndex: correctChoiceIndex,
    explanation: shorten(firstSentences(source.explanation), 260),
    source: `Practice question ${source.order}`
  };
}

function seed(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function rotate<T>(values: T[], by: number): T[] {
  const offset = by % values.length;
  return [...values.slice(offset), ...values.slice(0, offset)];
}

function firstSentences(value: string, count = 2): string {
  const sentences = value.trim().match(/[^.!?]+[.!?]+(?:\s|$)/g);
  return sentences ? sentences.slice(0, count).join("").trim() : value.trim();
}

function shorten(value: string, max: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).trimEnd()}…`;
}
