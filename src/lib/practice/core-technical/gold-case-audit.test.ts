import { describe, expect, it } from "vitest";

import { NODEJS_CORE_TECHNICAL_DOMAIN_MAP } from "./domain-map";
import { auditCoreTechnicalGoldCases } from "./gold-case-audit";
import { NODEJS_CORE_TECHNICAL_GOLD_CASES } from "./gold-cases";
import { coreTechnicalGoldCaseSchema } from "./gold-evaluation-contracts";
import { NODEJS_CORE_TECHNICAL_INTERVIEW_PATTERNS } from "./interview-patterns";

function audit(cases = NODEJS_CORE_TECHNICAL_GOLD_CASES) {
  return auditCoreTechnicalGoldCases({
    cases,
    domainMap: NODEJS_CORE_TECHNICAL_DOMAIN_MAP,
    patterns: NODEJS_CORE_TECHNICAL_INTERVIEW_PATTERNS
  });
}

describe("Core Technical gold-case audit", () => {
  it("keeps approved benchmarks structurally valid and release ready", () => {
    const result = audit();

    expect(result.structurallyValid).toBe(true);
    expect(result.releaseReady).toBe(true);
    expect(result.unapprovedCaseKeys).toEqual([]);
  });

  it("requires a real reviewer attestation before approval", () => {
    expect(() =>
      coreTechnicalGoldCaseSchema.parse({
        ...NODEJS_CORE_TECHNICAL_GOLD_CASES[0],
        review: {
          status: "approved",
          reviewerId: null,
          reviewedAt: null,
          notes: ["The benchmark was checked for technical accuracy and interview relevance."]
        }
      })
    ).toThrow("require a reviewer");
  });

  it("detects a gold mechanism that does not match its interview pattern", () => {
    const changed = structuredClone(NODEJS_CORE_TECHNICAL_GOLD_CASES);
    changed[0]!.expected.requiredPrimaryMechanismKeys[0] = "wrong-mechanism";

    expect(audit(changed).primaryMechanismMismatches).toContain(
      "follow-operation-guided-benchmark:stage-1:javascript-identity-mutation-copy"
    );
  });
});
