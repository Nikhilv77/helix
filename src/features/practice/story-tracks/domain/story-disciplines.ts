import type { PersistedAiMlPracticeTrack } from "@/features/practice/ai-ml/domain/ai-ml-practice";
import {
  aiMlPracticeQuestionCount,
  aiMlStoryPaths,
  type AiMlStoryPath
} from "@/features/practice/ai-ml/domain/ai-ml-story-catalog";
import { aiMlQuickCheckPath } from "@/features/practice/ai-ml/domain/ai-ml-quick-check-catalog";
import { aiMlResumePracticePath } from "@/features/practice/ai-ml/domain/resume-practice-path";
import type { CandidateProfile } from "@/lib/shared/types";
import { dataStoryPaths } from "./data-story-catalog";
import { frontendStoryPaths } from "./frontend-story-catalog";

/**
 * Role disciplines served by the story-practice engine. Each one owns a
 * Core Technical and an Applied Engineering track built from authored paths.
 */
export const STORY_DISCIPLINES = ["ai-ml", "frontend", "data"] as const;
export type StoryDiscipline = (typeof STORY_DISCIPLINES)[number];

export function isStoryDiscipline(value: unknown): value is StoryDiscipline {
  return typeof value === "string" && (STORY_DISCIPLINES as readonly string[]).includes(value);
}

/** The discipline whose story tracks a candidate practises, if any. */
export function storyDisciplineForRole(
  role: CandidateProfile["targetRole"] | undefined
): StoryDiscipline | null {
  return isStoryDiscipline(role) ? role : null;
}

type TrackCopy = { title: string; purpose: string; covers: string[]; durationMinutes: number };

export interface StoryDisciplineDefinition {
  discipline: StoryDiscipline;
  label: string;
  candidateRole: string;
  /** Who the written-answer evaluator should grade as. */
  reviewer: string;
  overviewDescription: string;
  tracks: Record<PersistedAiMlPracticeTrack, TrackCopy>;
  paths(track: PersistedAiMlPracticeTrack): AiMlStoryPath[];
  /** AI/ML keeps its original eight-question cohort as a quick-check path. */
  quickCheck(track: PersistedAiMlPracticeTrack): AiMlStoryPath | null;
  resumePath(profile: CandidateProfile, track: PersistedAiMlPracticeTrack): AiMlStoryPath | null;
  /** Authored questions a new cohort receives, excluding any resume path. */
  catalogQuestionCount(track: PersistedAiMlPracticeTrack): number;
  /** AI/ML candidates also practise Architecture & Design scenarios. */
  includesArchitecture: boolean;
}

const DEFINITIONS: Record<StoryDiscipline, StoryDisciplineDefinition> = {
  "ai-ml": {
    discipline: "ai-ml",
    label: "AI/ML",
    candidateRole: "AI/ML engineer",
    reviewer: "experienced AI/ML engineer",
    overviewDescription: "Work through practical AI/ML decisions, one piece of evidence at a time.",
    tracks: {
      "core-technical": {
        title: "Core Technical · AI/ML",
        purpose: "Reason through models, evaluation, data quality, retrieval, and ML fundamentals.",
        covers: ["Model evaluation", "Data and features", "Retrieval and LLM reasoning"],
        durationMinutes: 35
      },
      "applied-engineering": {
        title: "Applied Engineering · AI/ML",
        purpose:
          "Diagnose realistic production model, retrieval, safety, latency, and rollout problems.",
        covers: ["Production diagnosis", "Safe model delivery", "Observability and operations"],
        durationMinutes: 40
      }
    },
    paths: aiMlStoryPaths,
    quickCheck: aiMlQuickCheckPath,
    resumePath: aiMlResumePracticePath,
    catalogQuestionCount: aiMlPracticeQuestionCount,
    includesArchitecture: true
  },
  frontend: {
    discipline: "frontend",
    label: "Frontend",
    candidateRole: "frontend engineer",
    reviewer: "experienced senior frontend engineer",
    overviewDescription:
      "Work through browser, React, and production frontend decisions, one piece of evidence at a time.",
    tracks: {
      "core-technical": {
        title: "Core Technical · Frontend",
        purpose: "Reason about the browser runtime, rendering, React state, and accessibility.",
        covers: ["Event loop and rendering", "React correctness", "Accessibility"],
        durationMinutes: 40
      },
      "applied-engineering": {
        title: "Applied Engineering · Frontend",
        purpose:
          "Diagnose slow pages and broken releases with real performance and error evidence.",
        covers: ["Core Web Vitals", "Release recovery", "Production debugging"],
        durationMinutes: 45
      }
    },
    paths: frontendStoryPaths,
    quickCheck: () => null,
    resumePath: () => null,
    catalogQuestionCount: (track) => countQuestions(frontendStoryPaths(track)),
    includesArchitecture: false
  },
  data: {
    discipline: "data",
    label: "Data",
    candidateRole: "data engineer",
    reviewer: "experienced senior data engineer",
    overviewDescription:
      "Work through modeling, SQL, and pipeline decisions, one piece of evidence at a time.",
    tracks: {
      "core-technical": {
        title: "Core Technical · Data",
        purpose: "Model data correctly and reason about SQL semantics and performance at scale.",
        covers: ["Dimensional modeling", "SQL semantics", "Query performance"],
        durationMinutes: 40
      },
      "applied-engineering": {
        title: "Applied Engineering · Data",
        purpose: "Diagnose pipeline failures, wrong dashboards, and runaway warehouse cost.",
        covers: ["Pipeline reliability", "Data quality", "Metric incidents"],
        durationMinutes: 45
      }
    },
    paths: dataStoryPaths,
    quickCheck: () => null,
    resumePath: () => null,
    catalogQuestionCount: (track) => countQuestions(dataStoryPaths(track)),
    includesArchitecture: false
  }
};

export function storyDiscipline(discipline: StoryDiscipline): StoryDisciplineDefinition {
  return DEFINITIONS[discipline];
}

/** Every path a discipline shows for a track, in display order. */
export function storyDisciplinePaths(
  discipline: StoryDiscipline,
  track: PersistedAiMlPracticeTrack
): AiMlStoryPath[] {
  const definition = storyDiscipline(discipline);
  const quickCheck = definition.quickCheck(track);
  return [...definition.paths(track), ...(quickCheck ? [quickCheck] : [])];
}

/**
 * Catalog questions plus the candidate's resume path. A saved cohort can hold
 * more after a content release, so its own count wins when larger.
 */
export function storyTrackQuestionTotal(
  profile: CandidateProfile,
  discipline: StoryDiscipline,
  track: PersistedAiMlPracticeTrack,
  savedQuestions = 0
): number {
  const definition = storyDiscipline(discipline);
  return Math.max(
    savedQuestions,
    definition.catalogQuestionCount(track) +
      (definition.resumePath(profile, track)?.questions.length ?? 0)
  );
}

/** Public URL of a discipline's track overview. */
export function storyTrackHref(
  discipline: StoryDiscipline,
  track: PersistedAiMlPracticeTrack
): `/practice/${StoryDiscipline}/${PersistedAiMlPracticeTrack}` {
  return `/practice/${discipline}/${track}`;
}

function countQuestions(paths: readonly AiMlStoryPath[]): number {
  return paths.reduce((total, path) => total + path.questions.length, 0);
}
