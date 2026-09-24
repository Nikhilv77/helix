import type { CandidateProfile } from "@/lib/shared/types";
import type { AiMlStoryQuestion } from "./ai-ml-story-catalog";

export type AiMlPracticePath = {
  key: string;
  title: string;
  description: string;
  expectedMinutes: number;
  questions: Array<
    Pick<AiMlStoryQuestion, "id" | "title" | "format" | "topicKeys" | "interaction">
  >;
};

export type AiMlPracticeRecommendation = {
  blockId: string;
  questionId: string;
  questionTitle: string;
  reason: string;
};

type SavedQuestion = {
  id: string;
  questionKey: string;
  status: string;
  draft: unknown;
};

const topicSignals = [
  {
    label: "retrieval and search",
    evidence: /\b(rag|retrieval|search|embedding|vector|indexing)\b/i,
    topic: /retriev|search|embedding|rag|citation|index/i
  },
  {
    label: "language models",
    evidence: /\b(llm|nlp|language model|prompt|chatbot|generation)\b/i,
    topic: /llm|nlp|prompt|generation|grounding|safety/i
  },
  {
    label: "computer vision",
    evidence: /\b(vision|image|visual|ocr|detection|camera)\b/i,
    topic: /vision|image|visual|ocr|detection|distribution/i
  },
  {
    label: "model delivery",
    evidence: /\b(mlops|serving|inference|deployment|pipeline|monitoring|feature store)\b/i,
    topic: /serving|latency|rollout|feature|monitor|incident|production/i
  },
  {
    label: "model evaluation",
    evidence: /\b(evaluation|classification|prediction|metrics|experiment|fraud)\b/i,
    topic: /evaluation|metric|validation|threshold|classification|fraud|experiment/i
  }
] as const;

/** Chooses the next saved question without changing frozen content or completed attempts. */
export function recommendAiMlPractice(input: {
  profile: CandidateProfile;
  paths: readonly AiMlPracticePath[];
  questions: readonly SavedQuestion[];
}): AiMlPracticeRecommendation | null {
  const byKey = new Map(input.questions.map((question) => [question.questionKey, question]));
  const resume = input.profile.resume;
  const evidence = [
    ...(resume?.skills ?? []),
    ...(resume?.projects ?? []).flatMap((project) => [
      project.name,
      project.summary,
      ...project.skills
    ]),
    ...(resume?.experience ?? []).flatMap((entry) => [entry.summary, ...entry.skills]),
    ...input.profile.focusAreas
  ].join(" ");
  const needsReview =
    input.profile.preparationOnboarding.skillProfile?.signals
      .flatMap((signal) => signal.topics ?? [])
      .filter((topic) => topic.familiarity === "needs-refresh")
      .map((topic) => normalizeTopic(topic.label)) ?? [];
  const senior = input.profile.level === "3-5" || input.profile.level === "5-plus";
  const advanced = input.profile.level === "5-plus";

  const ranked = input.paths
    .flatMap((path, pathIndex) =>
      path.questions.flatMap((question, questionIndex) => {
        const saved = byKey.get(question.id);
        if (!saved || saved.status !== "ACTIVE") return [];
        const topics = question.topicKeys.join(" ");
        const resumeMatch = topicSignals.find(
          (signal) => signal.evidence.test(evidence) && signal.topic.test(topics)
        );
        const baselineMatch = needsReview.some((topic) =>
          question.topicKeys.some((key) => {
            const normalizedKey = normalizeTopic(key);
            return normalizedKey.includes(topic) || topic.includes(normalizedKey);
          })
        );
        return [
          {
            path,
            question,
            saved,
            pathIndex,
            questionIndex,
            resumeMatch,
            baselineMatch,
            score:
              (resumeMatch ? 8 : 0) +
              (baselineMatch ? 5 : 0) +
              (saved.draft ? 6 : 0) +
              levelScore(question, path.key, senior, advanced)
          }
        ];
      })
    )
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.pathIndex - right.pathIndex ||
        left.questionIndex - right.questionIndex
    );
  const best = ranked[0];
  if (!best) return null;
  const reason = best.saved.draft
    ? "Continue the answer you already started. Your saved work is ready."
    : best.baselineMatch
      ? "Your baseline marked this topic for review. Start here, then use the feedback to choose the next step."
      : best.resumeMatch
        ? `Your resume points to ${best.resumeMatch.label}. This question connects that experience to an interview decision.`
        : senior
            ? "Start with a production decision that fits your experience level."
            : "Start with a guided check, then move into the longer scenarios.";
  return {
    blockId: best.path.key,
    questionId: best.saved.id,
    questionTitle: best.question.title,
    reason
  };
}

function normalizeTopic(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function levelScore(
  question: Pick<AiMlStoryQuestion, "format" | "interaction">,
  pathKey: string,
  senior: boolean,
  advanced: boolean
): number {
  if (!senior) return (pathKey === "quick-check" ? 5 : 0) + (question.format === "mcq" ? 3 : 0);
  return (
    (pathKey.startsWith("resume-project-") ? 4 : 0) +
    (question.format === "production-decision" ? 4 : 0) +
    (question.format === "artifact-diagnosis" ? 3 : 0) +
    (question.interaction ? 2 : 0) +
    (advanced && question.format === "mcq" ? -3 : 0)
  );
}
