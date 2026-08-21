import { DSA_CHAPTERS } from "./frontend-plan";
import type { DsaQuestion } from "../dsa/dsa";

/**
 * What Maya says when she takes a session.
 *
 * Every line here is derived from the question bank the chapter actually
 * contains — concepts, mistakes and signals are counted across the real
 * questions rather than written per chapter. A chapter whose questions carry
 * no signals produces no signals section instead of filler.
 */

export interface BriefPoint {
  /** The point itself, taken verbatim from question metadata. */
  text: string;
  /** How many questions in this chapter raised it. Drives ordering. */
  weight: number;
}

export interface ChapterBrief {
  slug: string;
  title: string;
  whyItMatters: string;
  /** Patterns this chapter draws from, as stored on the questions. */
  patterns: string[];
  totalQuestions: number;
  totalMinutes: number;
  counts: { easy: number; medium: number; hard: number };
  /** Ordered most-shared-first, so Maya leads with what recurs. */
  concepts: BriefPoint[];
  mistakes: BriefPoint[];
  signals: BriefPoint[];
  /** Distinct high-level approaches seen across the chapter's questions. */
  approachNames: string[];
  firstQuestionSlug: string | null;
}

/** Points shared by several questions matter more than one-offs. */
function rank(values: string[][], limit: number): BriefPoint[] {
  const tally = new Map<string, number>();
  for (const list of values) {
    // Count each question once, so a question repeating itself cannot dominate.
    for (const value of new Set(list)) {
      const key = value.trim();
      if (!key) continue;
      tally.set(key, (tally.get(key) ?? 0) + 1);
    }
  }

  return [...tally.entries()]
    .map(([text, weight]) => ({ text, weight }))
    .sort((a, b) => b.weight - a.weight || a.text.localeCompare(b.text))
    .slice(0, limit);
}

export function buildChapterBrief(
  chapterSlug: string,
  questions: DsaQuestion[]
): ChapterBrief | null {
  const config = DSA_CHAPTERS.find((chapter) => chapter.id === chapterSlug);
  if (!config || questions.length === 0) return null;

  const counts = { easy: 0, medium: 0, hard: 0 };
  for (const question of questions) counts[question.difficulty] += 1;

  const approachNames = [
    ...new Set(questions.flatMap((q) => (q.approaches ?? []).map((a) => a.name.trim())))
  ]
    .filter(Boolean)
    .slice(0, 6);

  return {
    slug: config.id,
    title: config.title,
    whyItMatters: config.whyItMatters,
    patterns: [...new Set(questions.map((q) => q.primaryPattern))],
    totalQuestions: questions.length,
    totalMinutes: questions.reduce((total, q) => total + q.expectedTimeMinutes, 0),
    counts,
    concepts: rank(
      questions.map((q) => q.conceptsTested),
      6
    ),
    mistakes: rank(
      questions.map((q) => q.commonMistakes),
      5
    ),
    signals: rank(
      questions.map((q) => q.interviewSignals),
      4
    ),
    approachNames,
    firstQuestionSlug: questions[0]?.slug ?? null
  };
}

/**
 * Maya's spoken script for the session, as discrete beats.
 *
 * Kept separate from the rendered panels: the voice route reads these strings
 * directly, so they have to survive being heard without the screen.
 */
export interface BriefBeat {
  id: string;
  eyebrow: string;
  title: string;
  /** Shown on screen and spoken aloud — one string, so they never diverge. */
  body: string;
  points: string[];
}

export function briefBeats(brief: ChapterBrief): BriefBeat[] {
  const beats: BriefBeat[] = [
    {
      id: "why",
      eyebrow: "The session",
      title: `Let's take ${brief.title}.`,
      body: `${brief.whyItMatters} There are ${brief.totalQuestions} questions here, about ${Math.max(Math.round(brief.totalMinutes / 60), 1)} hours of work. I'll set up the pattern, then you solve.`,
      points: []
    }
  ];

  if (brief.concepts.length) {
    beats.push({
      id: "concepts",
      eyebrow: "What this tests",
      title: "The ideas that keep coming back.",
      body: "These are the concepts your questions in this chapter actually test. If you can name which one a problem needs, you have already done most of the thinking.",
      points: brief.concepts.map((point) => point.text)
    });
  }

  if (brief.approachNames.length) {
    beats.push({
      id: "approach",
      eyebrow: "How to approach",
      title: "Reach for these, in this order.",
      body: "Say the brute force out loud first, then improve it. Interviewers want to watch you move between approaches, not jump straight to the optimal one.",
      points: brief.approachNames
    });
  }

  if (brief.mistakes.length) {
    beats.push({
      id: "mistakes",
      eyebrow: "Where people slip",
      title: "The traps I want you to avoid.",
      body: "These are the mistakes recorded against the questions in this chapter. Read them once now — they are much cheaper to avoid than to debug.",
      points: brief.mistakes.map((point) => point.text)
    });
  }

  if (brief.signals.length) {
    beats.push({
      id: "signals",
      eyebrow: "What they score",
      title: "What a strong answer looks like.",
      body: "This is what an interviewer is listening for while you work. Narrate these as you go, even when you are still writing.",
      points: brief.signals.map((point) => point.text)
    });
  }

  beats.push({
    id: "start",
    eyebrow: "Your turn",
    title: "Now you solve.",
    body: `I'll stay on the side of each question with hints if you get stuck. Take them one at a time, and mark each one done so I can keep your path current. Starting with ${brief.totalQuestions} questions ahead of you.`,
    points: []
  });

  return beats;
}
