import {
  coreTechnicalDomainMapSchema,
  coreTechnicalInterviewPatternSchema,
  interviewEvidenceSourceSchema,
  technicalSourceSchema,
  type CoreTechnicalDomainMap,
  type CoreTechnicalInterviewPattern,
  type InterviewEvidenceSource,
  type TechnicalSource
} from "./contracts";

export type CoreTechnicalCoverageReport = {
  ok: boolean;
  duplicateTopicKeys: string[];
  duplicatePatternKeys: string[];
  duplicateEvidenceSourceIds: string[];
  duplicateTechnicalSourceIds: string[];
  uncoveredEssentialTopicKeys: string[];
  unknownPatternReferences: string[];
  unknownTopicReferences: string[];
  unlinkedTopicPatternPairs: string[];
  unknownEvidenceReferences: string[];
  unknownTechnicalSourceReferences: string[];
  insufficientIndependentEvidencePatternKeys: string[];
  incompatiblePublishedPatternKeys: string[];
  orphanPublishedPatternKeys: string[];
  invalidPrerequisiteReferences: string[];
  prerequisiteCycles: string[][];
};

type CoverageInput = {
  domainMap: CoreTechnicalDomainMap;
  patterns: CoreTechnicalInterviewPattern[];
  evidenceSources: InterviewEvidenceSource[];
  technicalSources: TechnicalSource[];
};

function duplicateValues(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }

  return [...duplicates].sort();
}

function findPrerequisiteCycles(domainMap: CoreTechnicalDomainMap): string[][] {
  const prerequisites = new Map(
    domainMap.topics.map((topic) => [topic.key, topic.prerequisiteTopicKeys])
  );
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const path: string[] = [];
  const cycles = new Map<string, string[]>();

  function visit(topicKey: string): void {
    if (visited.has(topicKey)) return;

    if (visiting.has(topicKey)) {
      const cycleStart = path.indexOf(topicKey);
      const cycle = [...path.slice(cycleStart), topicKey];
      const normalized = [...cycle.slice(0, -1)].sort().join("|");
      cycles.set(normalized, cycle);
      return;
    }

    visiting.add(topicKey);
    path.push(topicKey);

    for (const prerequisite of prerequisites.get(topicKey) ?? []) {
      if (prerequisites.has(prerequisite)) visit(prerequisite);
    }

    path.pop();
    visiting.delete(topicKey);
    visited.add(topicKey);
  }

  for (const topic of domainMap.topics) visit(topic.key);
  return [...cycles.values()];
}

export function auditCoreTechnicalCoverage(input: CoverageInput): CoreTechnicalCoverageReport {
  const domainMap = coreTechnicalDomainMapSchema.parse(input.domainMap);
  const patterns = coreTechnicalInterviewPatternSchema.array().parse(input.patterns);
  const evidenceSources = interviewEvidenceSourceSchema.array().parse(input.evidenceSources);
  const technicalSources = technicalSourceSchema.array().parse(input.technicalSources);

  const topicKeys = new Set(domainMap.topics.map((topic) => topic.key));
  const patternByKey = new Map(patterns.map((item) => [item.key, item]));
  const evidenceById = new Map(evidenceSources.map((item) => [item.id, item]));
  const technicalSourceIds = new Set(technicalSources.map((item) => item.id));
  const referencedPatternKeys = new Set(
    domainMap.topics.flatMap((topic) => topic.interviewPatternKeys)
  );
  const publishedPatterns = patterns.filter((item) => item.status === "published");

  const unknownPatternReferences = domainMap.topics
    .flatMap((topic) =>
      topic.interviewPatternKeys
        .filter((patternKey) => !patternByKey.has(patternKey))
        .map((patternKey) => topic.key + ":" + patternKey)
    )
    .sort();

  const unknownTopicReferences = publishedPatterns
    .flatMap((item) =>
      item.topicKeys
        .filter((topicKey) => !topicKeys.has(topicKey))
        .map((topicKey) => item.key + ":" + topicKey)
    )
    .sort();

  const unlinkedTopicPatternPairs = publishedPatterns
    .flatMap((item) =>
      item.topicKeys
        .filter((topicKey) => {
          const topic = domainMap.topics.find((candidate) => candidate.key === topicKey);
          return topic && !topic.interviewPatternKeys.includes(item.key);
        })
        .map((topicKey) => item.key + ":" + topicKey)
    )
    .sort();

  const uncoveredEssentialTopicKeys = domainMap.topics
    .filter(
      (topic) =>
        topic.importance === "essential" &&
        !topic.interviewPatternKeys.some(
          (patternKey) => patternByKey.get(patternKey)?.status === "published"
        )
    )
    .map((topic) => topic.key)
    .sort();

  const unknownEvidenceReferences = publishedPatterns
    .flatMap((item) =>
      item.evidenceSourceIds
        .filter((sourceId) => !evidenceById.has(sourceId))
        .map((sourceId) => item.key + ":" + sourceId)
    )
    .sort();

  const unknownTechnicalSourceReferences = publishedPatterns
    .flatMap((item) =>
      item.technicalSourceIds
        .filter((sourceId) => !technicalSourceIds.has(sourceId))
        .map((sourceId) => item.key + ":" + sourceId)
    )
    .sort();

  const insufficientIndependentEvidencePatternKeys = publishedPatterns
    .filter((item) => {
      const publishers = new Set(
        item.evidenceSourceIds
          .map((sourceId) => evidenceById.get(sourceId)?.publisher)
          .filter((publisher): publisher is string => Boolean(publisher))
      );
      return publishers.size < 2;
    })
    .map((item) => item.key)
    .sort();

  const incompatiblePublishedPatternKeys = publishedPatterns
    .filter(
      (item) =>
        !item.languages.includes(domainMap.language) ||
        !item.runtimes.includes(domainMap.runtime) ||
        !item.roles.some((role) => domainMap.roles.includes(role))
    )
    .map((item) => item.key)
    .sort();

  const orphanPublishedPatternKeys = publishedPatterns
    .filter((item) => !referencedPatternKeys.has(item.key))
    .map((item) => item.key)
    .sort();

  const invalidPrerequisiteReferences = domainMap.topics
    .flatMap((topic) =>
      topic.prerequisiteTopicKeys
        .filter((prerequisite) => prerequisite === topic.key || !topicKeys.has(prerequisite))
        .map((prerequisite) => topic.key + ":" + prerequisite)
    )
    .sort();

  const reportWithoutOk = {
    duplicateTopicKeys: duplicateValues(domainMap.topics.map((item) => item.key)),
    duplicatePatternKeys: duplicateValues(patterns.map((item) => item.key)),
    duplicateEvidenceSourceIds: duplicateValues(evidenceSources.map((item) => item.id)),
    duplicateTechnicalSourceIds: duplicateValues(technicalSources.map((item) => item.id)),
    uncoveredEssentialTopicKeys,
    unknownPatternReferences,
    unknownTopicReferences,
    unlinkedTopicPatternPairs,
    unknownEvidenceReferences,
    unknownTechnicalSourceReferences,
    insufficientIndependentEvidencePatternKeys,
    incompatiblePublishedPatternKeys,
    orphanPublishedPatternKeys,
    invalidPrerequisiteReferences,
    prerequisiteCycles: findPrerequisiteCycles(domainMap)
  };

  return {
    ok: Object.values(reportWithoutOk).every((issues) => issues.length === 0),
    ...reportWithoutOk
  };
}

export function assertCoreTechnicalCoverage(input: CoverageInput): void {
  const report = auditCoreTechnicalCoverage(input);
  if (!report.ok) {
    throw new Error("Core Technical coverage audit failed: " + JSON.stringify(report));
  }
}
