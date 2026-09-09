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
    // 794, up from 772. The eleven class-operation questions gained Java and C++
    // runners (+22), and two questions that only ran in JavaScript and Python
    // were replaced by ones that run everywhere (+4). Four are still withheld:
    // `string-compression` and `remove-duplicates-from-sorted-array` are graded
    // on a first argument the solution must shrink, which a fixed-length Java
    // array cannot do; and `clone-graph` withholds Java and C++ because only the
    // JavaScript and Python adapters can tell a real deep copy from the
    // original nodes.
    expect(report.counts.advertisedLanguageContracts).toBe(794);
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
