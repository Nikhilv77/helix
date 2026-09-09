import type {
  StoryPracticeAssessmentView,
  StoryPracticeBlockView,
  StoryPracticeHistoryListView,
  StoryPracticeLibraryEntryView,
  StoryPracticeQuestionView
} from "@/features/practice/shared/ui/view-contracts";
import type { ArchitectureDesignScenarioLibraryEntry } from "@/features/practice/architecture-design/server/eligibility.service";
import type { ArchitectureDesignHistoryList } from "@/features/practice/architecture-design/server/history.service";
import type {
  ArchitectureDesignPublicBlock,
  ArchitectureDesignPublicQuestion
} from "@/features/practice/architecture-design/server/practice.service";

export function architectureDesignQuestionView(
  question: ArchitectureDesignPublicQuestion
): StoryPracticeQuestionView {
  return {
    ...question,
    question: { ...question.question },
    authorizedAnswer: question.authorizedAnswer
      ? {
          concise: question.authorizedAnswer.summary,
          explanation: question.authorizedAnswer.explanation
        }
      : null,
    latestAttempt: question.latestAttempt
      ? {
          ...question.latestAttempt,
          feedback: {
            schemaVersion: 1,
            score: question.latestAttempt.feedback.score,
            result: question.latestAttempt.feedback.result,
            didWell: question.latestAttempt.feedback.constraintUse,
            mechanism: question.latestAttempt.feedback.designReasoning,
            missingOrIncorrect: question.latestAttempt.feedback.tradeoffQuality,
            productionConsequence: question.latestAttempt.feedback.operationalSafety,
            transferExample: question.latestAttempt.feedback.communicationQuality,
            interviewerFollowUp: question.latestAttempt.feedback.interviewerFollowUp,
            missedEdgeCases: question.latestAttempt.feedback.missedConsiderations
          }
        }
      : null,
    latestRun: null
  };
}

export function architectureDesignAssessmentView(
  assessment: NonNullable<ArchitectureDesignPublicBlock["assessment"]>
): StoryPracticeAssessmentView {
  const report = assessment.report;
  const scoreByKind = report
    ? {
        "requirements-scope": report.scores.requirementsScope,
        "api-data-capacity": report.scores.apiDataCapacity,
        "architecture-tradeoffs": report.scores.architectureTradeoffs,
        "reliability-security-operability": report.scores.reliabilitySecurityOperability,
        "communication-evolution": report.scores.communicationEvolution
      }
    : null;
  return {
    ...assessment,
    report: report
      ? {
          scores: {
            technicalAccuracy: report.scores.requirementsScope,
            mechanismReasoning: report.scores.apiDataCapacity,
            diagnosisEvidence: report.scores.architectureTradeoffs,
            debuggingImplementation: report.scores.reliabilitySecurityOperability,
            communicationProduction: report.scores.communicationEvolution
          },
          overallScore: report.overallScore,
          teacherSummary: report.teacherSummary,
          strengths: report.strengths,
          improvementAreas: [...report.improvementAreas, ...report.nextSteps],
          promptFeedback:
            assessment.assessment?.prompts.map((prompt, index) => ({
              promptId: prompt.id,
              score: scoreByKind![prompt.kind],
              feedback:
                report.dimensionMastery[index]?.evidence ??
                report.nextSteps[index % report.nextSteps.length] ??
                report.teacherSummary
            })) ?? [],
          solvedVsLearned: report.solvedVsLearned,
          deterministicEvidence: {
            acceptedCodeQuestionCount: 0,
            totalCodeQuestionCount: 0,
            implementationScoreCapped: false
          },
          nextStory: {
            reason: report.nextScenario.reason,
            selectedStory: {
              title: report.nextScenario.selectedScenario.title,
              difficulty: report.nextScenario.selectedScenario.difficulty,
              emphasizedConceptKeys: report.nextScenario.selectedScenario.emphasizedDimensionKeys
            }
          }
        }
      : null
  };
}

export function architectureDesignBlockView(
  block: ArchitectureDesignPublicBlock
): StoryPracticeBlockView {
  return {
    ...block,
    story: {
      ...block.scenario,
      incident: block.scenario.premise,
      difficulty: block.selection.difficulty,
      mechanismKeys: block.scenario.dimensionKeys
    },
    questions: block.questions.map(architectureDesignQuestionView),
    assessment: block.assessment ? architectureDesignAssessmentView(block.assessment) : null
  };
}

export function architectureDesignHistoryView(
  history: ArchitectureDesignHistoryList
): StoryPracticeHistoryListView {
  return history.map((item) => ({
    ...item,
    story: {
      ...item.scenario,
      difficulty: item.difficulty,
      mechanismKeys: item.scenario.dimensionKeys
    }
  }));
}

export function architectureDesignLibraryView(
  entries: ArchitectureDesignScenarioLibraryEntry[]
): StoryPracticeLibraryEntryView[] {
  return entries.map((entry) => ({
    ...entry,
    mechanismKeys: entry.dimensionKeys
  }));
}
