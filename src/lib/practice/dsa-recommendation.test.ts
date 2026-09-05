import { describe, expect, it } from "vitest";
import { dsaPhases } from "@/lib/dsa/dsa";
import type { CandidatePracticeEvidence } from "@/lib/practice/practice-evidence";
import { buildFullDsaPlan, type PlanQuestion } from "@/lib/roadmap/frontend-plan";
import type { CandidateProfile } from "@/lib/shared/types";
import { buildDsaRecommendation } from "./dsa-recommendation";
import type { DsaBlockAssessmentReport } from "@/lib/dsa/block-assessment-report";

const NOW = Date.UTC(2026, 8, 4);

function plan() {
  const questions: PlanQuestion[] = dsaPhases().flatMap((phase, phaseIndex) =>
    phase.questions.map((question) => ({
      slug: question.slug,
      title: question.title,
      difficulty: question.difficulty,
      primaryPattern: question.primaryPattern,
      expectedTimeMinutes: question.expectedTimeMinutes,
      phaseSlug: `phase-${phaseIndex + 1}`,
      phaseNumber: phaseIndex + 1,
      recommendedOrder: question.recommendedOrder
    }))
  );
  return buildFullDsaPlan(questions);
}

function profile(
  startingState: "needs-foundations" | "experienced-active",
  level: CandidateProfile["level"] = "3-5"
) {
  return {
    targetRole: "fullstack" as const,
    level,
    targetDate: null,
    preparationOnboarding: {
      stage: "completed" as const,
      updatedAt: NOW,
      completedAt: NOW,
      baselineStartedAt: NOW,
      answers: {},
      questionIds: {},
      questions: {},
      skillProfile: {
        source: "initial-baseline" as const,
        generatedAt: NOW,
        signals: [
          {
            areaId: "dsa" as const,
            score: null,
            confidence: 0.34,
            evidence: "baseline" as const,
            startingState,
            topics: [
              { label: "Arrays & Hashing", familiarity: "needs-refresh" as const },
              { label: "Trees", familiarity: "familiar" as const }
            ]
          }
        ]
      }
    }
  };
}

function strongEvidence(): CandidatePracticeEvidence {
  return {
    schemaVersion: 1,
    id: "evidence-1",
    revision: 1,
    sourceAttemptFingerprint: "fingerprint-1",
    generatedAt: NOW,
    verifiedAttemptCount: 5,
    verifiedQuestionCount: 5,
    sourceAttemptIds: ["a1", "a2", "a3", "a4", "a5"],
    skills: [
      {
        skillKey: "problem-solving",
        score: 89,
        confidence: 0.88,
        sampleSize: 5,
        lastObservedAt: NOW,
        trend: 5,
        topicKeys: ["dsa:arrays-hashing"],
        hintsUsed: 0,
        hintDependenceRate: 0,
        repeatedAttemptCount: 0,
        retryDependenceRate: 0
      },
      {
        skillKey: "dsa-pattern:arrays-hashing",
        score: 91,
        confidence: 0.8,
        sampleSize: 5,
        lastObservedAt: NOW,
        trend: 4,
        topicKeys: ["dsa:arrays-hashing"],
        hintsUsed: 0,
        hintDependenceRate: 0,
        repeatedAttemptCount: 0,
        retryDependenceRate: 0
      }
    ],
    masteryTopics: [],
    weakTopics: [],
    recentQuestions: [],
    codeEvidence: []
  };
}

describe("buildDsaRecommendation", () => {
  it("uses weak assessment patterns to focus foundations while retaining verified practice evidence", () => {
    const report = {
      reportVersion: 1, overall: 42,
      metrics: { "pattern-recognition": 40, "correctness-edge-cases": 35, efficiency: 50, "code-quality": 50, communication: 60 },
      nextRecommendationSignals: { weakPatterns: ["arrays-hashing"], strongPatterns: [], evidencePrecedence: "assessment-complements-verified-practice" }
    } as unknown as DsaBlockAssessmentReport;
    const recommendation = buildDsaRecommendation({ plan: plan(), profile: profile("experienced-active"), evidence: strongEvidence(), assessmentReport: report, now: NOW });
    expect(recommendation?.tier).toBe("foundations");
    expect(recommendation?.source).toBe("assessment");
    expect(recommendation?.focusChapterId).toBe("arrays-hashing");
    expect(recommendation?.assessmentEvidence?.weakPatterns).toEqual(["arrays-hashing"]);
    expect(recommendation?.strengthLabel).not.toBeNull();
  });

  it("advances on strong assessment evidence and records the compact immutable signal", () => {
    const report = {
      reportVersion: 1, overall: 86,
      metrics: { "pattern-recognition": 88, "correctness-edge-cases": 82, efficiency: 84, "code-quality": 80, communication: 90 },
      nextRecommendationSignals: { weakPatterns: [], strongPatterns: ["arrays-hashing"], evidencePrecedence: "assessment-complements-verified-practice" }
    } as unknown as DsaBlockAssessmentReport;
    const recommendation = buildDsaRecommendation({ plan: plan(), profile: profile("needs-foundations"), evidence: strongEvidence(), assessmentReport: report, now: NOW });
    expect(recommendation?.tier).toBe("advanced");
    expect(recommendation?.focusChapterId).not.toBe("arrays-hashing");
    expect(recommendation?.assessmentEvidence?.overall).toBe(86);
    expect(recommendation?.assessmentEvidence?.strongPatterns).toEqual(["arrays-hashing"]);
  });

  it("gives a foundations candidate a small first block while retaining the 200-question path", () => {
    const recommendation = buildDsaRecommendation({
      plan: plan(),
      profile: profile("needs-foundations"),
      evidence: null,
      now: NOW
    });

    expect(recommendation).toMatchObject({
      tier: "foundations",
      source: "assessment",
      focusLabel: "Arrays & Hashing",
      estimatedPathQuestions: 200,
      availableQuestions: 200
    });
    expect(recommendation?.questions).toHaveLength(8);
    expect(recommendation?.mix.easy).toBeGreaterThan(recommendation?.mix.hard ?? 0);
  });

  it("uses verified evidence to give a strong senior mostly medium and hard work", () => {
    const recommendation = buildDsaRecommendation({
      plan: plan(),
      profile: profile("experienced-active", "5-plus"),
      evidence: strongEvidence(),
      now: NOW
    });

    expect(recommendation?.tier).toBe("advanced");
    expect(recommendation?.source).toBe("performance");
    expect(recommendation?.estimatedPathQuestions).toBeLessThan(40);
    expect((recommendation?.mix.medium ?? 0) + (recommendation?.mix.hard ?? 0)).toBeGreaterThan(
      recommendation?.mix.easy ?? 0
    );
  });

  it("removes completed questions from the next recommendation block", () => {
    const first = buildDsaRecommendation({
      plan: plan(),
      profile: profile("needs-foundations"),
      evidence: null,
      now: NOW
    });
    const completedSlug = first?.questions[0]?.slug;
    const next = buildDsaRecommendation({
      plan: plan(),
      profile: profile("needs-foundations"),
      evidence: null,
      statuses: completedSlug ? { [completedSlug]: "COMPLETED" } : {},
      now: NOW
    });

    expect(next?.questions.some((question) => question.slug === completedSlug)).toBe(false);
  });

  it("keeps skipped questions visible so the candidate can retry them", () => {
    const first = buildDsaRecommendation({
      plan: plan(),
      profile: profile("needs-foundations"),
      evidence: null,
      now: NOW
    });
    const skippedSlug = first?.questions[0]?.slug;
    const next = buildDsaRecommendation({
      plan: plan(),
      profile: profile("needs-foundations"),
      evidence: null,
      statuses: skippedSlug ? { [skippedSlug]: "SKIPPED" } : {},
      now: NOW
    });

    expect(next?.questions.some((question) => question.slug === skippedSlug)).toBe(true);
  });

  it("keeps every question in a saved block until the whole block is solved", () => {
    const first = buildDsaRecommendation({
      plan: plan(),
      profile: profile("needs-foundations"),
      evidence: null,
      now: NOW
    });
    const blockSlugs = first?.questions.map((question) => question.slug) ?? [];
    const completedSlug = blockSlugs[0];
    const current = buildDsaRecommendation({
      plan: plan(),
      profile: profile("needs-foundations"),
      evidence: null,
      statuses: completedSlug ? { [completedSlug]: "COMPLETED" } : {},
      blockQuestionSlugs: blockSlugs,
      now: NOW
    });

    expect(current?.questions.map((question) => question.slug)).toEqual(blockSlugs);
    expect(current?.questions.some((question) => question.slug === completedSlug)).toBe(true);
  });
});
