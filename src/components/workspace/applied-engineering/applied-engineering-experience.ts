import type { StoryPracticeAssessmentExperience } from "@/components/workspace/story-practice/story-practice-assessment";
import type { StoryPracticeIntroExperience } from "@/components/workspace/story-practice/story-practice-intro";
import type { StoryPracticeOverviewExperience } from "@/components/workspace/story-practice/story-practice-overview";
import type { StoryPracticePreparationExperience } from "@/components/workspace/story-practice/story-practice-preparation";
import type { StoryPracticeWorkspaceExperience } from "@/components/workspace/story-practice/story-practice-question-workspace";
import type { AppliedEngineeringPublicQuestion } from "@/server/applied-engineering/practice.service";
import {
  appliedEngineeringAssessmentView,
  appliedEngineeringQuestionView
} from "./applied-engineering-adapter";

export const APPLIED_ENGINEERING_PREPARATION_EXPERIENCE: StoryPracticePreparationExperience = {
  slug: "applied-engineering",
  apiBase: "/api/practice/applied-engineering",
  routeBase: "/practice/applied-engineering",
  subjectNoun: "incident",
  heading: "What language do you want to practise in?",
  optionLabel: "Practice language",
  optionIcon: "code",
  options: [
    { value: "javascript", label: "JavaScript", detail: "Node.js production incidents" }
  ],
  defaultOption: "javascript",
  buildConfirmation: (language) => ({ language })
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
  defenceDescription:
    "Defend your diagnosis, repair, verification, and safe-delivery decisions in five focused prompts.",
  answerPlaceholder:
    "Explain the evidence, root cause, repair, verification, and production consequence.",
  evidenceSummary: (report) =>
    `${report.solvedVsLearned.completedCount} solved · ${report.solvedVsLearned.learnedCount} learned · ${report.deterministicEvidence.acceptedCodeQuestionCount}/${report.deterministicEvidence.totalCodeQuestionCount} code questions accepted`,
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
  environmentLabel: "Node.js 22",
  libraryDescription: "Browse the reviewed production incidents in your Node.js path.",
  coachSteps: ["Read the production signal", "Isolate cause and blast radius", "Ship safely"],
  intro: APPLIED_ENGINEERING_INTRO_EXPERIENCE,
  assessment: APPLIED_ENGINEERING_ASSESSMENT_EXPERIENCE
};

export const APPLIED_ENGINEERING_WORKSPACE_EXPERIENCE: StoryPracticeWorkspaceExperience = {
  slug: "applied-engineering",
  label: "Applied Engineering",
  apiBase: "/api/practice/applied-engineering",
  routeBase: "/practice/applied-engineering",
  subjectNoun: "incident",
  environmentLabel: "JavaScript · Node.js 22",
  capabilities: { runCode: true },
  textAnswerPlaceholder:
    "Cite the evidence, isolate the root cause, and explain the safest production action…",
  feedbackReasoningLabel: "Root-cause reasoning",
  responseLabel: () => null,
  responseGuidance: () => null,
  adaptQuestion: (question) =>
    appliedEngineeringQuestionView(question as AppliedEngineeringPublicQuestion)
};
