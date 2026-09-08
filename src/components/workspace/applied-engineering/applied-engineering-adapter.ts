import type { CoreTechnicalPublicBlock, CoreTechnicalPublicQuestion } from "@/server/core-technical/practice.service";
import type { CoreTechnicalHistoryList } from "@/server/core-technical/history.service";
import type { CoreTechnicalStoryLibraryEntry } from "@/server/core-technical/eligibility.service";
import type { AppliedEngineeringPublicBlock, AppliedEngineeringPublicQuestion } from "@/server/applied-engineering/practice.service";
import type { AppliedEngineeringHistoryList } from "@/server/applied-engineering/history.service";
import type { AppliedEngineeringIncidentLibraryEntry } from "@/server/applied-engineering/eligibility.service";
import type { PublicAssessment } from "@/components/workspace/core-technical/core-technical-assessment";

/** Domain adapter only: Applied Engineering data stays separate while presentation is shared. */
export function appliedEngineeringQuestionView(
  question: AppliedEngineeringPublicQuestion
): CoreTechnicalPublicQuestion {
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
    question: {
      ...question.question,
      storyKey: question.question.incidentKey,
      mechanismKeys: question.question.productionSignalKeys
    },
    latestAttempt
  } as unknown as CoreTechnicalPublicQuestion;
}

export function appliedEngineeringAssessmentView(
  assessment: NonNullable<AppliedEngineeringPublicBlock["assessment"]>
): PublicAssessment {
  const report = assessment.report;
  return {
    ...assessment,
    assessment: assessment.assessment as PublicAssessment["assessment"],
    transcript: assessment.transcript as PublicAssessment["transcript"],
    report: report
      ? ({
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
              storyKey: report.nextIncident.selectedIncident.incidentKey,
              storyVersion: report.nextIncident.selectedIncident.incidentVersion,
              emphasizedConceptKeys:
                report.nextIncident.selectedIncident.emphasizedSignalKeys
            }
          }
        } as unknown as PublicAssessment["report"])
      : null
  } as PublicAssessment;
}

export function appliedEngineeringBlockView(
  block: AppliedEngineeringPublicBlock
): CoreTechnicalPublicBlock {
  return {
    ...block,
    story: {
      ...block.incident,
      mechanismKeys: block.incident.productionSignalKeys
    },
    selection: {
      ...block.selection,
      emphasizedConceptKeys: block.selection.emphasizedSignalKeys
    },
    questions: block.questions.map(appliedEngineeringQuestionView),
    assessment: block.assessment ? appliedEngineeringAssessmentView(block.assessment) : null
  } as unknown as CoreTechnicalPublicBlock;
}

export function appliedEngineeringHistoryView(
  history: AppliedEngineeringHistoryList
): CoreTechnicalHistoryList {
  return history.map((item) => ({
    ...item,
    story: {
      ...item.incident,
      mechanismKeys: item.incident.productionSignalKeys
    }
  })) as unknown as CoreTechnicalHistoryList;
}

export function appliedEngineeringLibraryView(
  entries: AppliedEngineeringIncidentLibraryEntry[]
): CoreTechnicalStoryLibraryEntry[] {
  return entries.map((entry) => ({
    ...entry,
    mechanismKeys: entry.productionSignalKeys
  })) as unknown as CoreTechnicalStoryLibraryEntry[];
}
