import { TEACHER_VOICE_LINES } from "@/features/practice/shared/domain/teacher-voice-lines";
import type { StoryPracticeAssessmentExperience } from "@/features/practice/shared/ui/story-practice-assessment";
import type { StoryPracticeIntroExperience } from "@/features/practice/shared/ui/story-practice-intro";
import type { StoryPracticeOverviewExperience } from "@/features/practice/shared/ui/story-practice-overview";
import type { StoryPracticePreparationExperience } from "@/features/practice/shared/ui/story-practice-preparation";
import type { StoryPracticeWorkspaceExperience } from "@/features/practice/shared/ui/story-practice-question-workspace";
import {
  ARCHITECTURE_DESIGN_API_BASE,
  ARCHITECTURE_DESIGN_KEY,
  ARCHITECTURE_DESIGN_ROUTE_BASE
} from "@/features/practice/architecture-design/domain/contracts";
import type { ArchitectureDesignPublicQuestion } from "@/features/practice/architecture-design/server/practice.service";
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
  script: TEACHER_VOICE_LINES.architectureDesignIntro
};

export const ARCHITECTURE_DESIGN_ASSESSMENT_EXPERIENCE: StoryPracticeAssessmentExperience = {
  slug: ARCHITECTURE_DESIGN_KEY,
  label: "Architecture & Design",
  apiBase: ARCHITECTURE_DESIGN_API_BASE,
  routeBase: ARCHITECTURE_DESIGN_ROUTE_BASE,
  subjectNoun: "scenario",
  mode: "shared-voice-room",
  evidenceAnchorLabel: "Design evidence",
  measures: [
    "Requirements & scope",
    "APIs, data & capacity",
    "Architecture & trade-offs",
    "Reliability, security & operability",
    "Communication & evolution"
  ],
  defenceDescription:
    "Complete two focused design decisions, then defend two end-to-end architectures with production evidence and the canvas.",
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
  startUnstartedPath: {
    endpoint: "/api/practice/architecture-design/start-path"
  },
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
  answerReview: "modal",
  capabilities: { runCode: false },
  textAnswerPlaceholder:
    "Describe components, request and data flow, storage, failure paths, and trade-offs…",
  feedbackReasoningLabel: "Design reasoning",
  responseLabel: (format) =>
    format === "artifact-diagnosis"
      ? "Diagnose the architecture"
      : format === "production-decision"
        ? "Defend your production decision"
        : "Frame your system-design answer",
  responseGuidance: (format) =>
    format === "artifact-diagnosis"
      ? "Trace the failure through components and data flow, quantify its impact, then propose an isolated and operable correction."
      : format === "production-decision"
        ? "State the outcome you need, compare realistic alternatives, and defend the trade-off, failure behavior, and rollout guardrails."
        : "Clarify scope and non-goals, state assumptions, show the important estimates, and turn ambiguous requirements into measurable SLOs.",
  adaptQuestion: (question) =>
    architectureDesignQuestionView(question as ArchitectureDesignPublicQuestion)
};
