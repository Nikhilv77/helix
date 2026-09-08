import type { StoryPracticeAssessmentExperience } from "@/components/workspace/core-technical/core-technical-assessment";
import type { StoryPracticeIntroExperience } from "@/components/workspace/core-technical/core-technical-intro";
import type { StoryPracticeOverviewExperience } from "@/components/workspace/core-technical/core-technical-overview";
import type { StoryPracticePreparationExperience } from "@/components/workspace/core-technical/core-technical-preparation";
import type { StoryPracticeWorkspaceExperience } from "@/components/workspace/core-technical/core-technical-question-workspace";
import type { AppliedEngineeringPublicQuestion } from "@/server/applied-engineering/practice.service";
import {
  appliedEngineeringAssessmentView,
  appliedEngineeringQuestionView
} from "./applied-engineering-adapter";

export const APPLIED_ENGINEERING_PREPARATION_EXPERIENCE: StoryPracticePreparationExperience = {
  slug: "applied-engineering",
  apiBase: "/api/practice/applied-engineering",
  routeBase: "/practice/applied-engineering",
  optionDetail: "Node.js production incidents",
  subjectNoun: "incident"
};

export const APPLIED_ENGINEERING_INTRO_EXPERIENCE: StoryPracticeIntroExperience = {
  label: "Applied Engineering",
  routeBase: "/practice/applied-engineering",
  subjectNoun: "incident",
  description: "Build production judgment through one connected engineering incident.",
  script: (title) =>
    `Your next incident is “${title}.” Follow the evidence, isolate the root cause, then ship the repair safely.`
};

export const APPLIED_ENGINEERING_ASSESSMENT_EXPERIENCE: StoryPracticeAssessmentExperience = {
  slug: "applied-engineering",
  label: "Applied Engineering",
  apiBase: "/api/practice/applied-engineering",
  routeBase: "/practice/applied-engineering",
  subjectNoun: "incident",
  measures: [
    "Diagnosis & evidence",
    "Implementation correctness",
    "Testing & verification",
    "Production judgment",
    "Ownership & safe delivery"
  ],
  scoreRows: (report) =>
    report
      ? [
          ["Diagnosis & evidence", report.scores.technicalAccuracy],
          ["Implementation correctness", report.scores.mechanismReasoning],
          ["Testing & verification", report.scores.diagnosisEvidence],
          ["Production judgment", report.scores.debuggingImplementation],
          ["Ownership & safe delivery", report.scores.communicationProduction]
        ]
      : [],
  adaptAssessment: (assessment) =>
    appliedEngineeringAssessmentView(
      assessment as Parameters<typeof appliedEngineeringAssessmentView>[0]
    )
};

export const APPLIED_ENGINEERING_OVERVIEW_EXPERIENCE: StoryPracticeOverviewExperience = {
  slug: "applied-engineering",
  label: "Applied Engineering",
  routeBase: "/practice/applied-engineering",
  subjectNoun: "incident",
  intro: APPLIED_ENGINEERING_INTRO_EXPERIENCE,
  assessment: APPLIED_ENGINEERING_ASSESSMENT_EXPERIENCE
};

export const APPLIED_ENGINEERING_WORKSPACE_EXPERIENCE: StoryPracticeWorkspaceExperience = {
  slug: "applied-engineering",
  label: "Applied Engineering",
  apiBase: "/api/practice/applied-engineering",
  routeBase: "/practice/applied-engineering",
  subjectNoun: "incident",
  adaptQuestion: (question) =>
    appliedEngineeringQuestionView(question as AppliedEngineeringPublicQuestion)
};
