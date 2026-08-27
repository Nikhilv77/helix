import { buildTestCases, buildTestHarness } from "./code-test-harness";
import { dsaPhases, isEnriched, phaseSlug } from "@/lib/dsa/dsa";
import {
  dsaFunctionName,
  dsaStarterCode,
  supportedDsaCodeLanguages
} from "@/lib/dsa/dsa-code-templates";

export const DSA_BANK_BASELINE = {
  phases: 11,
  questions: 200
} as const;

export interface DsaBankAuditReport {
  counts: {
    phases: number;
    questions: number;
    examples: number;
    enrichedQuestions: number;
    advertisedLanguageContracts: number;
  };
  duplicateSlugs: string[];
  missingPrerequisites: Array<{ slug: string; prerequisite: string }>;
  missingRelatedQuestions: Array<{ slug: string; related: string }>;
  incompleteQuestions: string[];
  editorialIssues: Array<{ slug: string; error: string }>;
  unrunnableExamples: Array<{ slug: string; error: string }>;
  starterContractErrors: Array<{ slug: string; language: string; error: string }>;
}

/**
 * Read-only content audit used before any DSA seed or migration. It protects
 * the authored source bank; database row counts are checked separately during
 * deployment because notes, progress, and attempts are environment-specific.
 */
export function auditDsaBank(): DsaBankAuditReport {
  const phases = dsaPhases();
  const questions = phases.flatMap((phase) => phase.questions);
  const knownSlugs = new Set(questions.map((question) => question.slug));
  const seen = new Set<string>();
  const duplicateSlugs = new Set<string>();
  const missingPrerequisites: DsaBankAuditReport["missingPrerequisites"] = [];
  const missingRelatedQuestions: DsaBankAuditReport["missingRelatedQuestions"] = [];
  const incompleteQuestions: string[] = [];
  const editorialIssues: DsaBankAuditReport["editorialIssues"] = [];
  const unrunnableExamples: DsaBankAuditReport["unrunnableExamples"] = [];
  const starterContractErrors: DsaBankAuditReport["starterContractErrors"] = [];
  let examples = 0;
  let advertisedLanguageContracts = 0;

  for (const phase of phases) {
    const key = phaseSlug(phase.phase);
    if (!key) incompleteQuestions.push(`[phase] ${phase.phase}`);

    for (const question of phase.questions) {
      if (seen.has(question.slug)) duplicateSlugs.add(question.slug);
      seen.add(question.slug);

      const teachingLayerComplete =
        isEnriched(question) &&
        (question.constraints?.length ?? 0) > 0 &&
        (question.examples?.length ?? 0) >= 2 &&
        (question.hints?.length ?? 0) >= 3 &&
        (question.approaches?.length ?? 0) >= 2 &&
        (question.edgeCases?.length ?? 0) >= 3 &&
        question.conceptsTested.length > 0 &&
        question.commonMistakes.length > 0 &&
        question.interviewSignals.length > 0 &&
        question.followUpPrompts.length > 0;
      if (!teachingLayerComplete) {
        incompleteQuestions.push(question.slug);
      }

      const normalizedHints = (question.hints ?? []).map((hint) => hint.trim().toLowerCase());
      const normalizedApproaches = (question.approaches ?? []).map((approach) =>
        approach.name.trim().toLowerCase()
      );
      const authoredCopy = JSON.stringify(question).toLowerCase();
      if ((question.problemStatement?.trim().length ?? 0) < 80) {
        editorialIssues.push({ slug: question.slug, error: "Problem statement is too brief." });
      }
      if (question.promptSummary.trim().length < 40) {
        editorialIssues.push({ slug: question.slug, error: "Prompt summary is too brief." });
      }
      if (question.highLevelApproach.trim().length < 40) {
        editorialIssues.push({ slug: question.slug, error: "High-level approach is too brief." });
      }
      if ((question.hints ?? []).some((hint) => hint.trim().length < 18)) {
        editorialIssues.push({ slug: question.slug, error: "A hint is too brief to teach from." });
      }
      if (new Set(normalizedHints).size !== normalizedHints.length) {
        editorialIssues.push({ slug: question.slug, error: "Hints must be distinct." });
      }
      if (new Set(normalizedApproaches).size !== normalizedApproaches.length) {
        editorialIssues.push({ slug: question.slug, error: "Approach names must be distinct." });
      }
      if (/todo|tbd|lorem ipsum|placeholder/.test(authoredCopy)) {
        editorialIssues.push({ slug: question.slug, error: "Placeholder copy remains." });
      }

      for (const prerequisite of question.prerequisites) {
        if (!knownSlugs.has(prerequisite)) {
          missingPrerequisites.push({ slug: question.slug, prerequisite });
        }
      }
      for (const related of question.relatedQuestions ?? []) {
        if (!knownSlugs.has(related)) {
          missingRelatedQuestions.push({ slug: question.slug, related });
        }
      }

      examples += question.examples?.length ?? 0;
      try {
        const testCases = buildTestCases(question.examples ?? [], question.slug);
        if (testCases.length !== question.examples?.length) {
          unrunnableExamples.push({
            slug: question.slug,
            error: "Not every authored example produced a test case."
          });
        }
        for (const language of supportedDsaCodeLanguages(question.slug)) {
          advertisedLanguageContracts += 1;
          try {
            const starter = dsaStarterCode(question, language);
            buildTestHarness(starter, language, dsaFunctionName(question.slug), testCases);
          } catch (error) {
            starterContractErrors.push({
              slug: question.slug,
              language,
              error: error instanceof Error ? error.message : "Starter contract failed."
            });
          }
        }
      } catch (error) {
        unrunnableExamples.push({
          slug: question.slug,
          error: error instanceof Error ? error.message : "Test-case parsing failed."
        });
      }
    }
  }

  return {
    counts: {
      phases: phases.length,
      questions: questions.length,
      examples,
      enrichedQuestions: questions.filter(isEnriched).length,
      advertisedLanguageContracts
    },
    duplicateSlugs: [...duplicateSlugs].sort(),
    missingPrerequisites,
    missingRelatedQuestions,
    incompleteQuestions,
    editorialIssues,
    unrunnableExamples,
    starterContractErrors
  };
}

export function dsaBankAuditFailures(report: DsaBankAuditReport): string[] {
  const failures: string[] = [];
  if (report.counts.phases < DSA_BANK_BASELINE.phases) {
    failures.push(
      `DSA phase count decreased from ${DSA_BANK_BASELINE.phases} to ${report.counts.phases}.`
    );
  }
  if (report.counts.questions < DSA_BANK_BASELINE.questions) {
    failures.push(
      `DSA question count decreased from ${DSA_BANK_BASELINE.questions} to ${report.counts.questions}.`
    );
  }
  if (report.duplicateSlugs.length) failures.push("DSA slugs must be unique.");
  if (report.missingPrerequisites.length) failures.push("Some prerequisites do not exist.");
  if (report.missingRelatedQuestions.length) failures.push("Some related questions do not exist.");
  if (report.incompleteQuestions.length) failures.push("Some questions lack teaching content.");
  if (report.editorialIssues.length) failures.push("Some questions fail editorial quality checks.");
  if (report.unrunnableExamples.length)
    failures.push("Some examples cannot become authored tests.");
  if (report.starterContractErrors.length) {
    failures.push("Some advertised language starters do not match their test harness contract.");
  }
  return failures;
}
