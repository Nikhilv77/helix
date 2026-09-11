import type {
  StoryPracticeAssessmentView,
  StoryPracticeBlockView,
  StoryPracticeContinuationDecisionView,
  StoryPracticeHistoryListView,
  StoryPracticeLibraryEntryView,
  StoryPracticeNextItemView,
  StoryPracticeQuestionView
} from "@/features/practice/shared/ui/view-contracts";
import type { AppliedEngineeringIncidentLibraryEntry } from "@/features/practice/applied-engineering/server/eligibility.service";
import type { AppliedEngineeringHistoryList } from "@/features/practice/applied-engineering/server/history.service";
import type { AppliedEngineeringAdaptiveIncidentSelection } from "@/features/practice/applied-engineering/domain/focus-ranking-contracts";
import type {
  AppliedEngineeringPublicBlock,
  AppliedEngineeringPublicQuestion
} from "@/features/practice/applied-engineering/server/practice.service";

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
  const nextStory = report?.nextIncident
    ? appliedEngineeringNextIncidentView(report.nextIncident)
    : undefined;
  const continuation = report ? appliedEngineeringContinuationView(report, nextStory) : undefined;
  return {
    ...assessment,
    report: report
      ? {
          scores: {
            technicalAccuracy: report.scores.diagnosisEvidence,
            mechanismReasoning: report.scores.implementationCorrectness,
            diagnosisEvidence: report.scores.testingVerification,
            debuggingImplementation: report.scores.productionJudgment,
            communicationProduction: report.scores.ownershipDelivery
          },
          overallScore: report.overallScore,
          teacherSummary: report.teacherSummary,
          strengths: report.strengths,
          improvementAreas: report.improvementAreas,
          promptFeedback: report.promptFeedback,
          solvedVsLearned: report.solvedVsLearned,
          deterministicEvidence: report.deterministicEvidence,
          ...(nextStory ? { nextStory } : {}),
          ...(continuation ? { continuation } : {})
        }
      : null
  };
}

function appliedEngineeringNextIncidentView(
  selection: AppliedEngineeringAdaptiveIncidentSelection
): StoryPracticeNextItemView {
  return {
    ...selection,
    selectedStory: {
      ...selection.selectedIncident,
      emphasizedConceptKeys: selection.selectedIncident.emphasizedSignalKeys
    }
  };
}

function appliedEngineeringContinuationView(
  report: NonNullable<NonNullable<AppliedEngineeringPublicBlock["assessment"]>["report"]>,
  legacyNext: StoryPracticeNextItemView | undefined
): StoryPracticeContinuationDecisionView | undefined {
  if (!report.continuation) {
    return legacyNext ? { kind: "continue", next: legacyNext } : undefined;
  }
  if (report.continuation.kind === "continue") {
    return {
      kind: "continue",
      next: appliedEngineeringNextIncidentView(report.continuation.next)
    };
  }
  return report.continuation;
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
