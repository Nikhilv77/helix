import { baselineQuestion } from "@/features/preparation-onboarding/domain/preparation-onboarding";
import { AI_ML_APPLIED_ENGINEERING_QUESTION_BANK } from "@/features/preparation-onboarding/domain/ai-ml-applied-engineering-question-bank";

export const AI_ML_PRACTICE_TRACKS = [
  "core-technical",
  "applied-engineering",
  "architecture-design"
] as const;

export type AiMlPracticeTrack = (typeof AI_ML_PRACTICE_TRACKS)[number];
export type PersistedAiMlPracticeTrack = Exclude<AiMlPracticeTrack, "architecture-design">;

export type AiMlPracticeQuestion = {
  id: string;
  title: string;
  prompt: string;
  options: Array<{ id: string; label: string }>;
  correctOptionId: string;
  explanation: string;
};

export type AiMlPracticeSession = {
  track: PersistedAiMlPracticeTrack;
  eyebrow: string;
  title: string;
  description: string;
  questions: AiMlPracticeQuestion[];
};

export type AiMlPracticePublicQuestion = Omit<
  AiMlPracticeQuestion,
  "correctOptionId" | "explanation"
> & {
  databaseId: string;
  selectedOptionId: string | null;
  correctOptionId?: string;
  correct: boolean | null;
  explanation: string | null;
};

export type AiMlPracticePublicSession = Omit<AiMlPracticeSession, "questions" | "track"> & {
  id: string;
  track: PersistedAiMlPracticeTrack;
  status: "ACTIVE" | "COMPLETED";
  questions: AiMlPracticePublicQuestion[];
  completedQuestions: number;
  progressPercent: number;
};

const CORE_EXPLANATIONS = [
  "An offline score is only a proxy. Compare the evaluation set with live inputs and measure the user outcome the model is meant to improve before choosing a new model.",
  "Slice recent inputs by the failing type and compare them with the training and evaluation distributions. More training cannot fix a shift you have not identified.",
  "A rollback needs the exact model, prompt, configuration, and evaluation snapshot from the previous release. A model name alone cannot reproduce its behaviour.",
  "First compare the retrieved chunks and source coverage across index versions. If retrieval supplied the wrong evidence, changing generation settings will not repair it.",
  "Reproduce the live prompt and input path, then inspect safety failures by meaningful slice. A passing offline average can hide a newly common unsafe case.",
  "Precision and recall trade off different kinds of mistakes. Choose the threshold using the product cost of false positives and false negatives, not whichever score looks larger.",
  "A versioned feature definition shared across training and serving prevents two implementations from silently producing different values. Validate parity on representative records.",
  "Check query formulation, ranking, and the actual source chunks before blaming the generator. A citation cannot be relevant if the retrieval path never supplied the right evidence."
] as const;

const APPLIED_EXPLANATIONS = [
  "Compare the affected segment against its previous model and a control group. That separates a release regression from a broader change in users or inputs.",
  "Long context may add model time, retrieval work, or both. Segment latency by context size and route so the slow boundary is visible before tuning it.",
  "Compare feature and prediction distributions on either side of the source release, especially for the affected slice. A shift in inputs can look like a model defect.",
  "A useful trace joins the request to retrieved evidence, prompt and model versions, and final answer. Without that lineage, you cannot distinguish retrieval error from generation error.",
  "A fraud threshold changes the balance of missed fraud and blocked legitimate users. Validate both outcomes against the agreed costs, not an unrelated infrastructure metric.",
  "A healthy total success rate can hide frequent fallback use or lower-quality answers. Measure primary failures, fallback quality, and what users actually experience.",
  "A completed upload does not prove the new content is searchable. Track source version, index completion, and the version actually retrieved for each answer.",
  "Review harmless requests that were blocked, sliced by task, language, and policy category. That lets you correct an overbroad rule without removing protection for risky cases."
] as const;

export function aiMlPracticeSession(track: PersistedAiMlPracticeTrack): AiMlPracticeSession {
  if (track === "core-technical") {
    return {
      track,
      eyebrow: "AI/ML · Core Technical",
      title: "Build the reasoning beneath the model.",
      description:
        "Work through evaluation, data, features, retrieval, model behaviour, and safety decisions that appear in AI/ML interviews.",
      questions: Array.from({ length: 8 }, (_, index) => {
        const source = baselineQuestion("technical-1", "ai-ml", `technical-${index}`);
        return {
          id: `ai-ml-core-${index + 1}`,
          title: source.prompt,
          prompt: source.prompt,
          options: source.options,
          correctOptionId: source.correctOptionId ?? "correct",
          explanation: CORE_EXPLANATIONS[index]!
        };
      })
    };
  }

  return {
    track,
    eyebrow: "AI/ML · Applied Engineering",
    title: "Operate the model, not only the notebook.",
    description:
      "Diagnose realistic incidents involving model quality, retrieval, releases, latency, observability, safety, and cost.",
    questions: AI_ML_APPLIED_ENGINEERING_QUESTION_BANK.slice(0, 8).map((source, index) => ({
      id: `ai-ml-applied-${index + 1}`,
      title: source.title,
      prompt: source.prompt,
      options: source.options,
      correctOptionId: source.correctOptionId,
      explanation: APPLIED_EXPLANATIONS[index]!
    }))
  };
}

export function isAiMlPracticeTrack(value: string): value is AiMlPracticeTrack {
  return (AI_ML_PRACTICE_TRACKS as readonly string[]).includes(value);
}
