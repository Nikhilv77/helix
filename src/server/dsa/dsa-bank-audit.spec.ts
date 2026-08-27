import { auditDsaBank, dsaBankAuditFailures, DSA_BANK_BASELINE } from "./dsa-bank-audit";

describe("DSA bank regression audit", () => {
  const report = auditDsaBank();

  it("does not shrink the established source bank", () => {
    expect(report.counts.phases).toBeGreaterThanOrEqual(DSA_BANK_BASELINE.phases);
    expect(report.counts.questions).toBeGreaterThanOrEqual(DSA_BANK_BASELINE.questions);
  });

  it("keeps all current questions enriched and backed by authored examples", () => {
    expect(report.counts.enrichedQuestions).toBe(report.counts.questions);
    expect(report.counts.examples).toBeGreaterThanOrEqual(report.counts.questions);
    expect(report.incompleteQuestions).toEqual([]);
    expect(report.editorialIssues).toEqual([]);
    expect(report.unrunnableExamples).toEqual([]);
    expect(report.counts.advertisedLanguageContracts).toBe(772);
    expect(report.starterContractErrors).toEqual([]);
  });

  it("keeps identities and question relationships valid", () => {
    expect(report.duplicateSlugs).toEqual([]);
    expect(report.missingPrerequisites).toEqual([]);
    expect(report.missingRelatedQuestions).toEqual([]);
  });

  it("passes the deployment failure policy", () => {
    expect(dsaBankAuditFailures(report)).toEqual([]);
  });
});
