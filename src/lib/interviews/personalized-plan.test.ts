import { describe, expect, it } from "vitest";
import {
  CANDIDATE_INTERVIEW_PROFILE_SCHEMA_VERSION,
  INTERVIEW_SESSION_KINDS,
  PERSONALIZED_INTERVIEW_PLAN_SCHEMA_VERSION,
  isPersonalizedInterviewPlan,
  parseCandidateInterviewProfile,
  parsePersonalizedInterviewPlan
} from "./personalized-plan";
import type {
  CandidateInterviewProfile,
  PersonalizedInterviewPlan,
  SessionBlueprint,
  SkillRelevanceScore
} from "./personalized-plan";

const relevance: SkillRelevanceScore = {
  score: 84,
  confidence: 0.91,
  signals: [
    {
      kind: "work-experience",
      strength: 0.9,
      weight: 0.8,
      contribution: 72,
      reason: "Used repeatedly in recent professional work."
    }
  ],
  reasons: ["Repeated, recent production evidence"]
};

function validProfile(): CandidateInterviewProfile {
  return {
    schemaVersion: CANDIDATE_INTERVIEW_PROFILE_SCHEMA_VERSION,
    id: "profile-ai-backend",
    revision: 1,
    sourceResumeFingerprint: "resume-sha256-a1",
    generatedAt: 1_750_000_000_000,
    headline: "AI and backend engineer",
    inferredRole: {
      title: "AI / Backend Engineer",
      family: "ai-ml",
      confidence: 0.92,
      rationale: "Recent experience and projects center on Python, retrieval, and APIs."
    },
    experience: {
      estimatedYears: 2.5,
      band: "mid",
      confidence: 0.86
    },
    skills: [
      {
        key: "python",
        label: "Python",
        category: "language",
        aliases: ["Python 3"],
        primary: true,
        evidence: [
          {
            id: "evidence-python-role",
            sourceKind: "work-experience",
            sourceId: "experience-1",
            sourceLabel: "AI Engineer at Example",
            excerpt: "Built document processing APIs in Python.",
            recencyMonths: 2,
            durationMonths: 24,
            occurrences: 4,
            confidence: 0.96
          }
        ],
        relevance
      }
    ],
    domains: [
      {
        key: "rag",
        label: "Retrieval-Augmented Generation",
        summary: "Designed retrieval and document-grounded generation workflows.",
        skillKeys: ["python"],
        evidenceIds: ["evidence-python-role"],
        relevance
      }
    ],
    importantProjects: [
      {
        id: "project-knowledge-assistant",
        name: "RAG knowledge assistant",
        summary: "Built a document-grounded assistant for an internal knowledge base.",
        candidateRole: "Designed and implemented the retrieval API.",
        outcome: "Reduced time spent searching internal documentation.",
        skillKeys: ["python"],
        evidenceIds: ["evidence-python-role"],
        importance: 0.9
      }
    ],
    warnings: []
  };
}

function session(kind: (typeof INTERVIEW_SESSION_KINDS)[number], index: number): SessionBlueprint {
  return {
    id: `session-${kind}`,
    kind,
    order: index + 1,
    title: `${kind} for Python`,
    subtitle: "Personalized from verified resume evidence",
    durationMinutes: 35,
    difficulty: "intermediate",
    rationale: "Tests the candidate's most relevant skills at the expected depth.",
    topics: [
      {
        key: "python",
        label: "Python",
        targetPercent: 60,
        skillKeys: ["python"],
        objectives: ["Explain implementation choices and trade-offs"]
      },
      {
        key: "rag",
        label: "RAG",
        targetPercent: 40,
        skillKeys: ["python"],
        objectives: ["Reason about retrieval quality and failure modes"]
      }
    ],
    structure: [
      {
        kind: "warm-up",
        questionCount: 2,
        formats: ["spoken"],
        purpose: "Establish practical familiarity."
      },
      {
        kind: "scenario",
        questionCount: 2,
        formats: ["spoken", "typed"],
        purpose: "Test applied engineering judgement."
      }
    ],
    followUpPolicy: {
      maxPerQuestion: 2,
      probeWeakClaims: true,
      increaseDifficultyAfterStrongAnswer: true,
      stayWithinBlueprintTopics: true
    },
    rubric: [
      {
        key: "technical-depth",
        label: "Technical depth",
        weightPercent: 60,
        strongSignals: ["Explains mechanisms and trade-offs"],
        weakSignals: ["Relies on terminology without explaining behavior"]
      },
      {
        key: "communication",
        label: "Communication",
        weightPercent: 40,
        strongSignals: ["Structures the answer and states assumptions"],
        weakSignals: ["Gives an unstructured or ambiguous answer"]
      }
    ]
  };
}

function validPlan(): PersonalizedInterviewPlan {
  return {
    schemaVersion: PERSONALIZED_INTERVIEW_PLAN_SCHEMA_VERSION,
    id: "plan-ai-backend",
    revision: 1,
    status: "ready",
    generatedAt: 1_750_000_000_100,
    sourceSnapshot: {
      candidateProfile: {
        id: "profile-ai-backend",
        revision: 1,
        sourceResumeFingerprint: "resume-sha256-a1"
      },
      targetRole: {
        title: "AI Engineer",
        family: "ai-ml",
        source: "declared"
      },
      jobDescription: null,
      performanceProfile: null
    },
    rationale: "Prioritizes Python, retrieval systems, and applied AI engineering.",
    sessions: INTERVIEW_SESSION_KINDS.map(session)
  };
}

describe("candidate interview profile contract", () => {
  it("accepts normalized skills with traceable evidence and relevance", () => {
    const parsed = parseCandidateInterviewProfile(validProfile());

    expect(parsed.inferredRole.title).toBe("AI / Backend Engineer");
    expect(parsed.skills[0]?.evidence[0]?.sourceKind).toBe("work-experience");
    expect(parsed.skills[0]?.relevance.score).toBe(84);
  });

  it("rejects duplicate canonical skill keys", () => {
    const profile = validProfile();
    const first = profile.skills[0];
    if (!first) throw new Error("Fixture must contain a skill");
    profile.skills.push({ ...first });

    expect(() => parseCandidateInterviewProfile(profile)).toThrow(/duplicates: python/i);
  });

  it("rejects confidence and relevance scores outside their declared bounds", () => {
    const profile = validProfile();
    const first = profile.skills[0];
    if (!first) throw new Error("Fixture must contain a skill");
    first.relevance.confidence = 1.1;

    expect(() => parseCandidateInterviewProfile(profile)).toThrow();
  });
});

describe("personalized interview plan contract", () => {
  it("accepts exactly the five stable session kinds with personalized content", () => {
    const parsed = parsePersonalizedInterviewPlan(validPlan());

    expect(parsed.sessions.map((item) => item.kind)).toEqual(INTERVIEW_SESSION_KINDS);
    expect(parsed.sessions[0]?.title).toContain("Python");
    expect(isPersonalizedInterviewPlan(parsed)).toBe(true);
  });

  it("rejects plans that omit one of the five sessions", () => {
    const plan = validPlan();
    plan.sessions.pop();

    expect(isPersonalizedInterviewPlan(plan)).toBe(false);
    expect(() => parsePersonalizedInterviewPlan(plan)).toThrow();
  });

  it("rejects reordered stable session kinds", () => {
    const plan = validPlan();
    const first = plan.sessions[0];
    const second = plan.sessions[1];
    if (!first || !second) throw new Error("Fixture must contain two sessions");
    plan.sessions[0] = second;
    plan.sessions[1] = first;

    expect(() => parsePersonalizedInterviewPlan(plan)).toThrow(/expected stable session kind/i);
  });

  it("requires topic and rubric weights to total 100 percent", () => {
    const plan = validPlan();
    const firstTopic = plan.sessions[0]?.topics[0];
    if (!firstTopic) throw new Error("Fixture must contain a topic");
    firstTopic.targetPercent = 50;

    expect(() => parsePersonalizedInterviewPlan(plan)).toThrow(/weights must total 100/i);
  });
});
