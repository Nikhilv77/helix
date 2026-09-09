import type { CoreTechnicalDomainMap, CoreTechnicalInterviewPattern } from "./contracts";
import {
  coreTechnicalGoldCaseSchema,
  type CoreTechnicalGoldCase
} from "./gold-evaluation-contracts";
import { REQUIRED_STORY_STAGE_FORMATS } from "./story-contracts";

export type CoreTechnicalGoldCaseAudit = {
  structurallyValid: boolean;
  releaseReady: boolean;
  duplicateCaseKeys: string[];
  unsupportedStackCaseKeys: string[];
  unknownTopicReferences: string[];
  unknownPatternReferences: string[];
  unsupportedStageFormats: string[];
  primaryMechanismMismatches: string[];
  difficultyMismatches: string[];
  unapprovedCaseKeys: string[];
};

export function auditCoreTechnicalGoldCases(input: {
  cases: CoreTechnicalGoldCase[];
  domainMap: CoreTechnicalDomainMap;
  patterns: CoreTechnicalInterviewPattern[];
}): CoreTechnicalGoldCaseAudit {
  const cases = coreTechnicalGoldCaseSchema.array().parse(input.cases);
  const topicKeys = new Set(input.domainMap.topics.map((topic) => topic.key));
  const patternByKey = new Map(input.patterns.map((pattern) => [pattern.key, pattern]));
  const duplicateCaseKeys = duplicates(cases.map((goldCase) => goldCase.key));
  const unsupportedStackCaseKeys: string[] = [];
  const unknownTopicReferences: string[] = [];
  const unknownPatternReferences: string[] = [];
  const unsupportedStageFormats: string[] = [];
  const primaryMechanismMismatches: string[] = [];
  const difficultyMismatches: string[] = [];

  for (const goldCase of cases) {
    const context = goldCase.candidateContext;
    if (
      context.language !== input.domainMap.language ||
      context.runtime !== input.domainMap.runtime ||
      !input.domainMap.roles.includes(context.role)
    ) {
      unsupportedStackCaseKeys.push(goldCase.key);
    }

    for (const topicKey of goldCase.expected.requiredStoryTopicKeys) {
      if (!topicKeys.has(topicKey)) {
        unknownTopicReferences.push(goldCase.key + ":" + topicKey);
      }
    }

    goldCase.expected.stagePatternKeys.forEach((patternKey, index) => {
      const pattern = patternByKey.get(patternKey);
      if (!pattern) {
        unknownPatternReferences.push(goldCase.key + ":" + patternKey);
        return;
      }
      const allowedFormats = REQUIRED_STORY_STAGE_FORMATS[index] ?? [];
      if (!pattern.formats.some((format) => allowedFormats.includes(format as never))) {
        unsupportedStageFormats.push(goldCase.key + ":stage-" + (index + 1) + ":" + patternKey);
      }
      if (pattern.mechanismKeys[0] !== goldCase.expected.requiredPrimaryMechanismKeys[index]) {
        primaryMechanismMismatches.push(goldCase.key + ":stage-" + (index + 1) + ":" + patternKey);
      }
    });

    const expectedDifficulty =
      context.baselineState === "UNKNOWN" ? "guided" : context.baselineState.toLowerCase();
    if (goldCase.expected.difficulty !== expectedDifficulty) {
      difficultyMismatches.push(goldCase.key);
    }
  }

  const unapprovedCaseKeys = cases
    .filter((goldCase) => goldCase.review.status !== "approved")
    .map((goldCase) => goldCase.key)
    .sort();
  const structuralIssues = [
    duplicateCaseKeys,
    unsupportedStackCaseKeys,
    unknownTopicReferences,
    unknownPatternReferences,
    unsupportedStageFormats,
    primaryMechanismMismatches,
    difficultyMismatches
  ];
  const structurallyValid = structuralIssues.every((issues) => issues.length === 0);

  return {
    structurallyValid,
    releaseReady: structurallyValid && unapprovedCaseKeys.length === 0,
    duplicateCaseKeys,
    unsupportedStackCaseKeys: unsupportedStackCaseKeys.sort(),
    unknownTopicReferences: unknownTopicReferences.sort(),
    unknownPatternReferences: unknownPatternReferences.sort(),
    unsupportedStageFormats: unsupportedStageFormats.sort(),
    primaryMechanismMismatches: primaryMechanismMismatches.sort(),
    difficultyMismatches: difficultyMismatches.sort(),
    unapprovedCaseKeys
  };
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated].sort();
}
