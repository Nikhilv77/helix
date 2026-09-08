import type { StoryPracticeAssessmentExperience } from "@/components/workspace/story-practice/story-practice-assessment";
import type { StoryPracticeIntroExperience } from "@/components/workspace/story-practice/story-practice-intro";
import type { StoryPracticeOverviewExperience } from "@/components/workspace/story-practice/story-practice-overview";
import type { StoryPracticePreparationExperience } from "@/components/workspace/story-practice/story-practice-preparation";
import type { StoryPracticeWorkspaceExperience } from "@/components/workspace/story-practice/story-practice-question-workspace";
import {
  ARCHITECTURE_DESIGN_API_BASE,
  ARCHITECTURE_DESIGN_KEY,
  ARCHITECTURE_DESIGN_ROUTE_BASE
} from "@/lib/practice/architecture-design/contracts";
import type { ArchitectureDesignPublicQuestion } from "@/server/architecture-design/practice.service";
import {
  architectureDesignAssessmentView,
  architectureDesignQuestionView
} from "./architecture-design-adapter";

export const ARCHITECTURE_DESIGN_PREPARATION_EXPERIENCE: StoryPracticePreparationExperience = {
  slug: ARCHITECTURE_DESIGN_KEY,
  apiBase: ARCHITECTURE_DESIGN_API_BASE,
  routeBase: ARCHITECTURE_DESIGN_ROUTE_BASE,
  subjectNoun: "scenario",
  heading: "Which system design path do you want to practise?",
  optionLabel: "System design path",
  optionIcon: "design",
  options: [
    {
      value: "role-aligned",
      label: "Role-aligned system design",
      detail: "Requirements, scale, boundaries, reliability, and trade-offs"
    }
  ],
  defaultOption: "role-aligned",
  buildConfirmation: (path) => ({ path })
};

export const ARCHITECTURE_DESIGN_INTRO_EXPERIENCE: StoryPracticeIntroExperience = {
  label: "Architecture & Design",
  routeBase: ARCHITECTURE_DESIGN_ROUTE_BASE,
  subjectNoun: "scenario",
  description: "Build system-design judgment through one connected architecture scenario.",
  script: (title) =>
    `Your next design scenario is “${title}.” Frame the requirements, trace the system, then defend the trade-offs.`
};

export const ARCHITECTURE_DESIGN_ASSESSMENT_EXPERIENCE: StoryPracticeAssessmentExperience = {
  slug: ARCHITECTURE_DESIGN_KEY,
  label: "Architecture & Design",
  apiBase: ARCHITECTURE_DESIGN_API_BASE,
  routeBase: ARCHITECTURE_DESIGN_ROUTE_BASE,
  subjectNoun: "scenario",
  measures: [
    "Requirements & scope",
    "APIs, data & capacity",
    "Architecture & trade-offs",
    "Reliability, security & operability",
    "Communication & evolution"
  ],
  defenceDescription:
    "Defend your requirements, boundaries, data flow, failure strategy, and evolution decisions in five focused prompts.",
  answerPlaceholder:
    "State assumptions, quantify the constraint, and defend the architecture trade-off.",
  evidenceSummary: (report) =>
    `${report.solvedVsLearned.completedCount} solved · ${report.solvedVsLearned.learnedCount} learned · no executable evidence required`,
  scoreRows: (report) =>
    report
      ? [
          ["Requirements & scope", report.scores.technicalAccuracy],
          ["APIs, data & capacity", report.scores.mechanismReasoning],
          ["Architecture & trade-offs", report.scores.diagnosisEvidence],
          ["Reliability, security & operability", report.scores.debuggingImplementation],
          ["Communication & evolution", report.scores.communicationProduction]
        ]
      : [],
  adaptAssessment: (assessment) =>
    architectureDesignAssessmentView(
      assessment as Parameters<typeof architectureDesignAssessmentView>[0]
    )
};

export const ARCHITECTURE_DESIGN_OVERVIEW_EXPERIENCE: StoryPracticeOverviewExperience = {
  slug: ARCHITECTURE_DESIGN_KEY,
  label: "Architecture & Design",
  routeBase: ARCHITECTURE_DESIGN_ROUTE_BASE,
  subjectNoun: "scenario",
  environmentLabel: null,
  libraryDescription: "Browse the reviewed system-design scenarios in your role-aligned path.",
  coachSteps: ["Frame scope and scale", "Trace boundaries and failure", "Defend trade-offs"],
  intro: ARCHITECTURE_DESIGN_INTRO_EXPERIENCE,
  assessment: ARCHITECTURE_DESIGN_ASSESSMENT_EXPERIENCE
};

export const ARCHITECTURE_DESIGN_WORKSPACE_EXPERIENCE: StoryPracticeWorkspaceExperience = {
  slug: ARCHITECTURE_DESIGN_KEY,
  label: "Architecture & Design",
  apiBase: ARCHITECTURE_DESIGN_API_BASE,
  routeBase: ARCHITECTURE_DESIGN_ROUTE_BASE,
  subjectNoun: "scenario",
  environmentLabel: null,
  capabilities: { runCode: false },
  textAnswerPlaceholder:
    "Describe components, request and data flow, storage, failure paths, and trade-offs…",
  feedbackReasoningLabel: "Design reasoning",
  responseLabel: () => null,
  responseGuidance: () => null,
  adaptQuestion: (question) =>
    architectureDesignQuestionView(question as ArchitectureDesignPublicQuestion)
};
