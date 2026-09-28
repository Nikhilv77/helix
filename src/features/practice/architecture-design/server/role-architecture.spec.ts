import { describe, expect, it, vi } from "vitest";
import {
  ARCHITECTURE_DESIGN_INTERVIEW_ONLY_SCENARIO_KEYS,
  ARCHITECTURE_DESIGN_PRACTICE_RANKING_CATALOGUE,
  ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE,
  architectureDesignTrackForScenario,
  auditArchitectureDesignContent,
  type ArchitectureDesignBaselineEvidence,
  type ArchitectureDesignConfirmedFocus,
  type ArchitectureDesignReviewArtifact
} from "@/features/practice/architecture-design/domain";
import {
  DATA_ARCHITECTURE_SCENARIOS,
  DATA_INTERVIEW_ONLY_SCENARIO_KEYS
} from "@/features/practice/architecture-design/domain/data-scenarios";
import {
  FRONTEND_ARCHITECTURE_SCENARIOS,
  FRONTEND_INTERVIEW_ONLY_SCENARIO_KEYS
} from "@/features/practice/architecture-design/domain/frontend-scenarios";
import { architectureDesignKnowledgeCheck } from "@/features/practice/architecture-design/domain/knowledge-check";
import { buildArchitectureDesignAssessmentSnapshot } from "./assessment-blueprint";
import { ArchitectureDesignEligibilityService } from "./eligibility.service";
import { ArchitectureDesignFocusService } from "./focus.service";
import { ArchitectureDesignScenarioRankingService } from "./scenario-ranking.service";

const FINGERPRINT = `sha256:${"b".repeat(64)}`;

type TrackCase = {
  role: "frontend" | "data";
  label: string;
  scenarios: readonly ArchitectureDesignReviewArtifact[];
  interviewOnlyKeys: readonly string[];
  practiceKeys: string[];
  resume: { skills: string[]; projects: Array<{ name: string; summary: string }> };
  expectedSkillKeys: string[];
  checkpointPhrases: string[];
};

/** Frontend and Data reuse the server engine; each gets its own content and wording. */
const TRACKS: TrackCase[] = [
  {
    role: "frontend",
    label: "Frontend",
    scenarios: FRONTEND_ARCHITECTURE_SCENARIOS,
    interviewOnlyKeys: FRONTEND_INTERVIEW_ONLY_SCENARIO_KEYS,
    practiceKeys: [
      "infinite-social-feed-client",
      "typeahead-search-client",
      "offline-field-inspection-app",
      "design-system-rollout"
    ],
    resume: {
      skills: ["React", "Next.js", "Core Web Vitals", "WCAG accessibility", "Storybook"],
      projects: [{ name: "Checkout", summary: "Built an offline PWA with IndexedDB." }]
    },
    expectedSkillKeys: [
      "frontend-architecture",
      "web-performance",
      "accessibility",
      "offline-first",
      "design-systems"
    ],
    checkpointPhrases: ["component tree and state ownership", "real-user metrics"]
  },
  {
    role: "data",
    label: "Data",
    scenarios: DATA_ARCHITECTURE_SCENARIOS,
    interviewOnlyKeys: DATA_INTERVIEW_ONLY_SCENARIO_KEYS,
    practiceKeys: [
      "clickstream-analytics-pipeline",
      "cdc-lakehouse-replication",
      "daily-revenue-reporting",
      "data-quality-lineage-platform"
    ],
    resume: {
      skills: ["Airflow", "dbt", "Snowflake", "Kafka", "Spark Structured Streaming", "Debezium"],
      projects: [
        {
          name: "Lakehouse",
          summary: "Moved CDC tables to Iceberg with Great Expectations checks."
        }
      ]
    },
    expectedSkillKeys: [
      "batch-orchestration",
      "warehouse-modeling",
      "stream-processing",
      "change-data-capture",
      "lakehouse-tables",
      "data-quality"
    ],
    checkpointPhrases: ["follow one record from its source", "freshness and completeness SLOs"]
  }
];

describe.each(TRACKS)("$label Architecture & Design content", (track) => {
  it("ships six release-eligible scenarios, two of them interview-only", () => {
    expect(track.scenarios.map((artifact) => artifact.scenario.key)).toEqual([
      ...track.practiceKeys,
      ...track.interviewOnlyKeys
    ]);
    for (const artifact of track.scenarios) {
      expect(artifact.scenario.roles).toEqual([track.role]);
      expect(architectureDesignTrackForScenario(artifact.scenario.key)).toBe(track.role);
      expect(auditArchitectureDesignContent(artifact)).toMatchObject({
        releaseEligible: true,
        coverageIssues: [],
        publicSafetyIssues: []
      });
      for (const question of artifact.questionBlock.questions) {
        expect(question.commonMistakes).toHaveLength(3);
        expect(new Set(question.commonMistakes).size).toBe(3);
        expect(question.commonMistakes).not.toContain(question.referenceAnswer.summary);
        if (question.format === "mcq") {
          expect(question.choices?.[question.correctChoiceIndex!]).toBeDefined();
        }
      }
    }
  });

  it("keeps interview-only scenarios out of the Practice catalogue", () => {
    const practice = ARCHITECTURE_DESIGN_PRACTICE_RANKING_CATALOGUE.filter(({ roles }) =>
      roles.includes(track.role)
    ).map(({ key }) => key);
    expect(practice).toEqual(track.practiceKeys);
    for (const key of track.interviewOnlyKeys) {
      expect(ARCHITECTURE_DESIGN_INTERVIEW_ONLY_SCENARIO_KEYS.has(key)).toBe(true);
      expect(ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE.some((c) => c.key === key)).toBe(true);
    }
  });

  it("builds knowledge checks from each question's own mistakes, not server-side fallbacks", () => {
    for (const artifact of track.scenarios) {
      for (const question of artifact.questionBlock.questions) {
        const check = architectureDesignKnowledgeCheck(question);
        const wrong = check.choices.filter((_, index) => index !== check.correctChoiceIndex);

        expect(check.choices[check.correctChoiceIndex]).toBe(question.referenceAnswer.summary);
        expect(wrong).toEqual(question.commonMistakes);
        expect(check.choices.join(" ")).not.toContain("Start drawing services");
      }
    }
  });
});

describe.each(TRACKS)("$label Architecture & Design practice", (track) => {
  it("confirms a focus with role-specific resume evidence", async () => {
    const service = new ArchitectureDesignFocusService({
      database: {
        candidateProfile: {
          findUnique: vi.fn().mockResolvedValue({
            targetRole: track.role,
            level: "3-5",
            targetCompany: null,
            targetDate: null,
            headline: null,
            resumeAnalysis: track.resume
          })
        },
        personalizedInterviewPlanVersion: { findFirst: vi.fn().mockResolvedValue(null) }
      },
      baselineEvidence: { derive: vi.fn().mockResolvedValue(evidence()) },
      now: () => new Date("2026-09-28T10:00:00Z")
    });

    const confirmed = await service.confirm(`user:${track.role}`, { path: "role-aligned" });

    expect(confirmed).toMatchObject({
      role: track.role,
      seniority: "mid",
      targetJob: `Mid-level ${track.label} Engineer`
    });
    expect(confirmed.resumeEvidence.architectureSkillKeys).toEqual(
      expect.arrayContaining(track.expectedSkillKeys)
    );
  });

  it.each(["fresher", "0-2", "3-5", "5-plus"] as const)(
    "offers %s learners the four Practice scenarios once they are published",
    async (level) => {
      const eligibility = await new ArchitectureDesignEligibilityService({
        publications: { published: async (items) => items }
      }).forProfile({ targetRole: track.role, level });

      expect(eligibility).toMatchObject({ available: true, reason: "AVAILABLE" });
      expect(eligibility.scenarios.map(({ key }) => key)).toEqual(track.practiceKeys);
    }
  );

  it("stays unavailable until at least two scenarios are published", async () => {
    const eligibility = await new ArchitectureDesignEligibilityService({
      publications: {
        published: async (items) => items.filter(({ key }) => key === track.practiceKeys[1])
      }
    }).forProfile({ targetRole: track.role, level: "3-5" });

    expect(eligibility.available).toBe(false);
    expect(eligibility.publishedScenarioCount).toBe(1);
  });

  it("ranks only this role's Practice scenarios, never interview-only ones", () => {
    const practice = new ArchitectureDesignScenarioRankingService(
      ARCHITECTURE_DESIGN_PRACTICE_RANKING_CATALOGUE
    );
    const first = practice.rankFirstScenario(focusFor(track));

    expect(track.practiceKeys).toContain(first.selectedScenario.scenarioKey);
    expect(
      first.rankings.every(({ scenarioKey }) => track.practiceKeys.includes(scenarioKey))
    ).toBe(true);
    // Once every Practice scenario is done, Practice has nothing left to offer;
    // it must not fall through to an interview-only case.
    expect(() =>
      practice.rankFirstScenario(focusFor(track), { recentScenarioKeys: track.practiceKeys })
    ).toThrow();
    expect(
      practice.findNextScenario(focusFor(track), {
        ...adaptiveEvidence(),
        priorScenarioKeys: track.practiceKeys
      })
    ).toBeNull();
  });

  it("lets the interview rank an interview-only scenario when Practice ones are excluded", () => {
    const interview = new ArchitectureDesignScenarioRankingService(
      ARCHITECTURE_DESIGN_SCENARIO_RANKING_CATALOGUE
    );
    const selection = interview.rankFirstScenario(focusFor(track), {
      recentScenarioKeys: track.practiceKeys
    });

    expect(track.interviewOnlyKeys).toContain(selection.selectedScenario.scenarioKey);
  });

  it("asks role-specific defence questions in the checkpoint", () => {
    const practice = new ArchitectureDesignScenarioRankingService(
      ARCHITECTURE_DESIGN_PRACTICE_RANKING_CATALOGUE
    );
    const selection = practice.rankFirstScenario(focusFor(track));
    const artifact = track.scenarios.find(
      (candidate) => candidate.scenario.key === selection.selectedScenario.scenarioKey
    )!;
    const snapshot = buildArchitectureDesignAssessmentSnapshot({
      blockContentFingerprint: FINGERPRINT,
      selectionSnapshot: selection,
      preparedAt: new Date("2026-09-28T10:00:00Z"),
      questions: artifact.questionBlock.questions.map((question) => ({
        id: `00000000-0000-4000-8000-00000000000${question.order}`,
        order: question.order,
        status: "COMPLETED" as const,
        contentFingerprint: FINGERPRINT,
        privateSnapshot: question
      }))
    });
    const text = snapshot.prompts
      .map((prompt) => prompt.prompt)
      .join(" ")
      .toLowerCase();

    for (const phrase of track.checkpointPhrases) expect(text).toContain(phrase.toLowerCase());
    expect(text).not.toContain("regional failure");
  });
});

function focusFor(track: TrackCase): ArchitectureDesignConfirmedFocus {
  return {
    schemaVersion: 1,
    focusFingerprint: FINGERPRINT,
    confirmedAt: "2026-09-28T10:00:00.000Z",
    path: "role-aligned",
    role: track.role,
    seniority: "mid",
    targetJob: `${track.label} Engineer`,
    targetCompany: null,
    targetDate: null,
    excludedScenarioKeys: [],
    resumeEvidence: {
      architectureSkillKeys: track.expectedSkillKeys.slice(0, 2),
      projectKeywords: []
    },
    planEvidence: { blueprintId: null, topicKeys: [], skillKeys: [] },
    baselineEvidence: evidence()
  };
}

function evidence(): ArchitectureDesignBaselineEvidence {
  return {
    schemaVersion: 1,
    registryVersion: 1,
    sourceFingerprint: FINGERPRINT,
    questionId: null,
    questionFingerprint: null,
    resolution: "MISSING",
    correctness: "UNKNOWN",
    state: "UNKNOWN",
    dimensionKeys: [],
    weakDimensionKeys: [],
    strongDimensionKeys: [],
    unassessedDimensionKeys: [],
    signalConsistency: "UNAVAILABLE"
  };
}

function adaptiveEvidence() {
  return {
    schemaVersion: 1 as const,
    assessmentScores: {
      requirementsScope: 65,
      apiDataCapacity: 65,
      architectureTradeoffs: 65,
      reliabilitySecurityOperability: 65,
      communicationEvolution: 65
    },
    practice: {
      completedCount: 4,
      learnedCount: 0,
      meanVerifiedScore: 7,
      hintsUsed: 1,
      weakDimensionKeys: ["consistency-transactions" as const],
      strongDimensionKeys: ["requirements-framing" as const]
    },
    priorScenarioKeys: [] as string[],
    priorTopicKeys: [] as string[]
  };
}
