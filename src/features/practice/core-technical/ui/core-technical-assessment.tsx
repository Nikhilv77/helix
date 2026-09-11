"use client";

import {
  StoryPracticeAssessment,
  type PublicAssessment,
  type StoryPracticeAssessmentExperience,
  type StoryPracticeAssessmentProps
} from "@/features/practice/shared/ui/story-practice-assessment";

export type { PublicAssessment, StoryPracticeAssessmentExperience };

export const CORE_TECHNICAL_ASSESSMENT_EXPERIENCE: StoryPracticeAssessmentExperience = {
  slug: "core-technical",
  label: "Core Technical",
  apiBase: "/api/practice/core-technical",
  routeBase: "/practice/core-technical",
  subjectNoun: "practice path",
  mode: "shared-voice-room",
  evidenceAnchorLabel: "Practice evidence",
  measures: [
    "Technical accuracy",
    "Mechanism reasoning",
    "Diagnosis evidence",
    "Debugging & implementation",
    "Communication & production"
  ],
  defenceDescription:
    "Defend the mechanisms, evidence, repair, and production consequences in five focused prompts.",
  answerPlaceholder: "Explain the mechanism, evidence, and production consequence.",
  evidenceSummary: (report) =>
    `${report.solvedVsLearned.completedCount} solved · ${report.solvedVsLearned.learnedCount} learned · ${report.deterministicEvidence.acceptedCodeQuestionCount}/${report.deterministicEvidence.totalCodeQuestionCount} code questions accepted`,
  scoreRows: (report) =>
    report
      ? [
          ["Technical accuracy", report.scores.technicalAccuracy],
          ["Mechanism reasoning", report.scores.mechanismReasoning],
          ["Diagnosis evidence", report.scores.diagnosisEvidence],
          ["Debugging & implementation", report.scores.debuggingImplementation],
          ["Communication & production", report.scores.communicationProduction]
        ]
      : [],
  adaptAssessment: (assessment) => assessment as PublicAssessment
};

export function CoreTechnicalAssessment({
  experience = CORE_TECHNICAL_ASSESSMENT_EXPERIENCE,
  ...props
}: Omit<StoryPracticeAssessmentProps, "experience"> & {
  experience?: StoryPracticeAssessmentExperience;
}) {
  return <StoryPracticeAssessment {...props} experience={experience} />;
}
