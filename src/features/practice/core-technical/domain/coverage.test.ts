import { describe, expect, it } from "vitest";

import { auditCoreTechnicalCoverage } from "./coverage";
import { NODEJS_CORE_TECHNICAL_DOMAIN_MAP } from "./domain-map";
import {
  CORE_TECHNICAL_INTERVIEW_EVIDENCE,
  CORE_TECHNICAL_SOURCES,
  NODEJS_CORE_TECHNICAL_INTERVIEW_PATTERNS
} from "./interview-patterns";

function audit(overrides: Partial<Parameters<typeof auditCoreTechnicalCoverage>[0]> = {}) {
  return auditCoreTechnicalCoverage({
    domainMap: NODEJS_CORE_TECHNICAL_DOMAIN_MAP,
    patterns: NODEJS_CORE_TECHNICAL_INTERVIEW_PATTERNS,
    evidenceSources: CORE_TECHNICAL_INTERVIEW_EVIDENCE,
    technicalSources: CORE_TECHNICAL_SOURCES,
    ...overrides
  });
}

describe("Core Technical coverage", () => {
  it("publishes a valid, fully covered Node.js catalogue", () => {
    expect(audit()).toEqual(
      expect.objectContaining({
        ok: true,
        uncoveredEssentialTopicKeys: [],
        orphanPublishedPatternKeys: [],
        insufficientIndependentEvidencePatternKeys: []
      })
    );
  });

  it("detects a published pattern that is not connected to the domain map", () => {
    const domainMap = {
      ...NODEJS_CORE_TECHNICAL_DOMAIN_MAP,
      topics: NODEJS_CORE_TECHNICAL_DOMAIN_MAP.topics.map((topic) =>
        topic.key === "javascript-modules"
          ? { ...topic, interviewPatternKeys: ["javascript-closure-lifetime"] }
          : topic
      )
    };

    const report = audit({ domainMap });

    expect(report.ok).toBe(false);
    expect(report.orphanPublishedPatternKeys).toContain("nodejs-commonjs-esm-boundary");
    expect(report.unlinkedTopicPatternPairs).toContain(
      "nodejs-commonjs-esm-boundary:javascript-modules"
    );
  });

  it("detects an essential topic with no published pattern", () => {
    const patterns = NODEJS_CORE_TECHNICAL_INTERVIEW_PATTERNS.map((item) =>
      item.key === "nodejs-stream-backpressure" ? { ...item, status: "draft" as const } : item
    );

    expect(audit({ patterns }).uncoveredEssentialTopicKeys).toContain("nodejs-streams-and-io");
  });

  it("requires evidence from two independent publishers", () => {
    const patterns = NODEJS_CORE_TECHNICAL_INTERVIEW_PATTERNS.map((item) =>
      item.key === "javascript-event-loop-order"
        ? {
            ...item,
            evidenceSourceIds: [
              "tarmac-javascript-interview-questions",
              "tarmac-javascript-interview-questions"
            ]
          }
        : item
    );

    expect(audit({ patterns }).insufficientIndependentEvidencePatternKeys).toContain(
      "javascript-event-loop-order"
    );
  });

  it("detects unknown pattern references and prerequisite cycles", () => {
    const topics = NODEJS_CORE_TECHNICAL_DOMAIN_MAP.topics.map((topic) => {
      if (topic.key === "javascript-values-and-mutation") {
        return {
          ...topic,
          prerequisiteTopicKeys: ["javascript-scope-and-closures"],
          interviewPatternKeys: [...topic.interviewPatternKeys, "missing-interview-pattern"]
        };
      }
      return topic;
    });

    const report = audit({
      domainMap: { ...NODEJS_CORE_TECHNICAL_DOMAIN_MAP, topics }
    });

    expect(report.unknownPatternReferences).toContain(
      "javascript-values-and-mutation:missing-interview-pattern"
    );
    expect(report.prerequisiteCycles).toContainEqual([
      "javascript-values-and-mutation",
      "javascript-scope-and-closures",
      "javascript-values-and-mutation"
    ]);
  });
});
