import type {
  AppliedEngineeringQuestion
} from "@/features/practice/applied-engineering/domain/question-contracts";
import { CoreTechnicalRunnerService } from "@/features/practice/core-technical/server/runner.service";
import type { CoreTechnicalRunResult } from "@/features/practice/core-technical/server/runner-contracts";

export type AppliedEngineeringRunResult = CoreTechnicalRunResult;

/** Adapts the shared isolated Node 22 runner without exposing Core contracts. */
export class AppliedEngineeringRunnerService {
  constructor(private readonly core = new CoreTechnicalRunnerService()) {}

  supportsStack(stack: { language: string; runtime: string; runtimeVersion: string }): boolean {
    return this.core.supportsStack(stack);
  }

  run(question: AppliedEngineeringQuestion, code: string): Promise<AppliedEngineeringRunResult> {
    return this.core.run(toCoreQuestion(question), code);
  }
}

function toCoreQuestion(question: AppliedEngineeringQuestion) {
  if (!question.starterCode || !question.referenceSolution || !question.publicTests || !question.hiddenTests || !question.wrongSolutions || !question.runnerContract) {
    throw new Error("Applied Engineering question is not executable");
  }
  return {
    schemaVersion: 1 as const,
    key: question.key,
    storyKey: question.incidentKey,
    stageKey: question.stageKey,
    order: question.order,
    format: question.format,
    patternKey: question.patternKey,
    topicKeys: question.topicKeys,
    mechanismKeys: question.productionSignalKeys,
    prompt: question.prompt,
    artifact: {
      kind: question.artifact.kind === "waterfall" || question.artifact.kind === "query-plan" ? "scenario" : question.artifact.kind,
      title: question.artifact.title,
      content: question.artifact.content.slice(0, 4_000)
    },
    choices: question.choices,
    hints: question.hints,
    answer: question.answer,
    rubric: question.rubric,
    commonMistakes: question.commonMistakes,
    interviewerFollowUps: question.interviewerFollowUps,
    interviewConnection: question.interviewConnection,
    starterCode: question.starterCode,
    referenceSolution: question.referenceSolution,
    publicTests: question.publicTests,
    hiddenTests: question.hiddenTests,
    wrongSolutions: question.wrongSolutions,
    runnerContract: question.runnerContract
  };
}
