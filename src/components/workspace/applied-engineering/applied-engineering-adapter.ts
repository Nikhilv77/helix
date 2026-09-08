import type {
  StoryPracticeAssessmentView,
  StoryPracticeBlockView,
  StoryPracticeHistoryListView,
  StoryPracticeLibraryEntryView,
  StoryPracticeQuestionView
} from "@/components/workspace/story-practice/view-contracts";
import type { AppliedEngineeringIncidentLibraryEntry } from "@/server/applied-engineering/eligibility.service";
import type { AppliedEngineeringHistoryList } from "@/server/applied-engineering/history.service";
import type {
  AppliedEngineeringPublicBlock,
  AppliedEngineeringPublicQuestion
} from "@/server/applied-engineering/practice.service";

/** Domain adapter only: Applied Engineering data stays separate while presentation is shared. */
export function appliedEngineeringQuestionView(
  question: AppliedEngineeringPublicQuestion
): StoryPracticeQuestionView {
  const latestAttempt = question.latestAttempt
    ? {
        ...question.latestAttempt,
        feedback: {
          schemaVersion: 1 as const,
          score: question.latestAttempt.feedback.score,
          result: question.latestAttempt.feedback.result,
          didWell: question.latestAttempt.feedback.evidenceUse,
          mechanism: question.latestAttempt.feedback.rootCauseReasoning,
          missingOrIncorrect: `${question.latestAttempt.feedback.repairQuality} ${question.latestAttempt.feedback.verificationQuality}`,
          productionConsequence: question.latestAttempt.feedback.productionConsequence,
          transferExample: question.latestAttempt.feedback.saferDelivery,
          interviewerFollowUp: question.latestAttempt.feedback.interviewerFollowUp,
          missedEdgeCases: question.latestAttempt.feedback.missedEdgeCases
        }
      }
    : null;
  return {
    ...question,
    question: { ...question.question },
    latestAttempt,
    latestRun: question.latestRun
      ? {
          id: question.latestRun.id,
          code: question.latestRun.code,
          result: question.latestRun.result,
          createdAt: question.latestRun.createdAt
        }
      : null
  };
}

export function appliedEngineeringAssessmentView(
  assessment: NonNullable<AppliedEngineeringPublicBlock["assessment"]>
): StoryPracticeAssessmentView {
  const report = assessment.report;
  return {
    ...assessment,
    report: report
      ? {
          ...report,
          scores: {
            technicalAccuracy: report.scores.diagnosisEvidence,
            mechanismReasoning: report.scores.implementationCorrectness,
            diagnosisEvidence: report.scores.testingVerification,
            debuggingImplementation: report.scores.productionJudgment,
            communicationProduction: report.scores.ownershipDelivery
          },
          nextStory: {
            ...report.nextIncident,
            selectedStory: {
              ...report.nextIncident.selectedIncident,
              emphasizedConceptKeys: report.nextIncident.selectedIncident.emphasizedSignalKeys
            }
          }
        }
      : null
  };
}

export function appliedEngineeringBlockView(
  block: AppliedEngineeringPublicBlock
): StoryPracticeBlockView {
  return {
    ...block,
    story: {
      ...block.incident,
      mechanismKeys: block.incident.productionSignalKeys
    },
    selection: {
      ...block.selection
    },
    questions: block.questions.map(appliedEngineeringQuestionView),
    assessment: block.assessment ? appliedEngineeringAssessmentView(block.assessment) : null
  };
}

export function appliedEngineeringHistoryView(
  history: AppliedEngineeringHistoryList
): StoryPracticeHistoryListView {
  return history.map((item) => ({
    ...item,
    story: {
      ...item.incident,
      mechanismKeys: item.incident.productionSignalKeys
    }
  }));
}

export function appliedEngineeringLibraryView(
  entries: AppliedEngineeringIncidentLibraryEntry[]
): StoryPracticeLibraryEntryView[] {
  return entries.map((entry) => ({
    ...entry,
    mechanismKeys: entry.productionSignalKeys
  }));
}
