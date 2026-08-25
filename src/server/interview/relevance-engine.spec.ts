import type { CandidateResume } from "@/lib/shared/types";
import { compileCandidateInterviewProfile } from "./candidate-profile-compiler";
import { RELEVANCE_POLICY_VERSION, rankCandidateInterviewRelevance } from "./relevance-engine";

const NOW = Date.UTC(2026, 7, 24);

function resume(overrides: Partial<CandidateResume> = {}): CandidateResume {
  return {
    fileName: "candidate.pdf",
    uploadedAt: NOW,
    confidence: 94,
    fullName: "Candidate",
    skills: [],
    warnings: [],
    experience: [],
    education: [],
    projects: [],
    achievements: [],
    practiceQuestions: [],
    roadmap: [],
    document: {
      format: "pdf",
      pageCount: 1,
      pageCountEstimated: false,
      sections: ["experience", "projects", "skills"]
    },
    evidence: {
      dateRanges: 0,
      achievementLines: 0,
      quantifiedAchievements: 0,
      experienceEntries: 0,
      projectEntries: 0,
      educationEntries: 0
    },
    interviewKit: null,
    ...overrides
  };
}

function mixedProfile() {
  return compileCandidateInterviewProfile({
    resume: resume({
      skills: ["React", "TypeScript", "Node.js", "Python", "LLMs", "RAG"],
      experience: [
        {
          organization: "AI Co",
          role: "AI Engineer",
          period: "Jan 2023 - Present",
          location: "",
          summary: "Built Python services and language-model workflows.",
          achievements: [],
          skills: ["Python", "LLMs", "RAG"]
        }
      ],
      projects: [
        {
          name: "Operations portal",
          summary: "Built a typed React operations application.",
          outcome: "Reduced manual work.",
          skills: ["React.js", "TypeScript", "Node.js"]
        }
      ]
    }),
    generatedAt: NOW,
    profileId: "mixed-profile"
  });
}

describe("target-role relevance", () => {
  it("prioritizes target technologies over unrelated substantial experience", () => {
    const result = rankCandidateInterviewRelevance({
      profile: mixedProfile(),
      targetRole: {
        title: "React Frontend Engineer",
        family: "frontend",
        source: "declared",
        skillPriorities: [{ key: "typescript", importance: 0.95 }]
      },
      now: NOW
    });

    const positions = new Map(result.rankedSkills.map((skill) => [skill.key, skill.rank]));
    expect(positions.get("react")).toBeLessThan(positions.get("llm") ?? Infinity);
    expect(positions.get("typescript")).toBeLessThan(positions.get("python") ?? Infinity);

    const react = result.profile.skills.find((skill) => skill.key === "react");
    expect(react?.relevance.signals).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "target-role" })])
    );
    expect(react?.relevance.reasons.join(" ")).toMatch(/target role/i);
  });

  it("keeps substantial work above projects and skills-only mentions when alignment is similar", () => {
    const profile = compileCandidateInterviewProfile({
      resume: resume({
        skills: ["Node.js", "Express", "Redis"],
        experience: [
          {
            organization: "API Co",
            role: "Backend Engineer",
            period: "2022 - Present",
            location: "",
            summary: "Built Node services.",
            achievements: [],
            skills: ["Node.js"]
          }
        ],
        projects: [
          {
            name: "API starter",
            summary: "Built an API starter project.",
            outcome: "",
            skills: ["Express"]
          }
        ]
      }),
      generatedAt: NOW
    });
    const result = rankCandidateInterviewRelevance({
      profile,
      targetRole: { title: "Backend Engineer", family: "backend", source: "declared" },
      now: NOW
    });
    const scores = new Map(result.rankedSkills.map((skill) => [skill.key, skill.relevanceScore]));

    expect(scores.get("nodejs") ?? 0).toBeGreaterThan(scores.get("express") ?? 0);
    expect(scores.get("express") ?? 0).toBeGreaterThan(scores.get("redis") ?? 0);
  });

  it("accepts explicit domain priorities without coupling plans to a technology stack", () => {
    const result = rankCandidateInterviewRelevance({
      profile: mixedProfile(),
      targetRole: {
        title: "Applied AI Engineer",
        family: "ai-ml",
        source: "declared",
        domainPriorities: [
          {
            key: "applied-ai",
            importance: 1,
            reason: "Applied AI is the primary target domain."
          }
        ]
      },
      now: NOW
    });

    expect(result.rankedDomains[0]?.key).toBe("applied-ai");
    expect(result.profile.skills.find((skill) => skill.key === "rag")?.relevance.reasons).toContain(
      "Applied AI is the primary target domain."
    );
  });
});

describe("job-description precedence", () => {
  it("lets a required job skill outrank stronger but less relevant resume history", () => {
    const result = rankCandidateInterviewRelevance({
      profile: mixedProfile(),
      targetRole: {
        title: "Full Stack Engineer",
        family: "fullstack",
        source: "declared"
      },
      jobDescription: {
        confidence: 1,
        requiredSkills: [
          { key: "python", importance: 1, reason: "Python is required for the target role." }
        ],
        preferredSkills: [],
        domainPriorities: []
      },
      now: NOW
    });

    const python = result.rankedSkills.find((skill) => skill.key === "python");
    const react = result.rankedSkills.find((skill) => skill.key === "react");
    expect(python?.relevanceScore ?? 0).toBeGreaterThan(react?.relevanceScore ?? 0);
    expect(
      result.profile.skills
        .find((skill) => skill.key === "python")
        ?.relevance.signals.find((signal) => signal.kind === "job-description")
    ).toMatchObject({ reason: "Python is required for the target role." });
  });

  it("uses target-role weights when an empty job-description context is supplied", () => {
    const withoutJob = rankCandidateInterviewRelevance({
      profile: mixedProfile(),
      targetRole: { title: "React Engineer", family: "frontend", source: "declared" },
      now: NOW
    });
    const emptyJob = rankCandidateInterviewRelevance({
      profile: mixedProfile(),
      targetRole: { title: "React Engineer", family: "frontend", source: "declared" },
      jobDescription: {
        confidence: 1,
        requiredSkills: [],
        preferredSkills: [],
        domainPriorities: []
      },
      now: NOW
    });

    expect(emptyJob.rankedSkills).toEqual(withoutJob.rankedSkills);
  });
});

describe("performance adaptation", () => {
  it("raises coverage for weakness and raises difficulty for demonstrated strength", () => {
    const profile = mixedProfile();
    const result = rankCandidateInterviewRelevance({
      profile,
      targetRole: {
        title: "React TypeScript Engineer",
        family: "frontend",
        source: "declared",
        skillPriorities: [
          { key: "react", importance: 1 },
          { key: "typescript", importance: 1 }
        ]
      },
      performance: [
        {
          skillKey: "react",
          score: 94,
          confidence: 0.95,
          sampleSize: 3,
          lastObservedAt: NOW - 7 * 24 * 60 * 60 * 1_000
        },
        {
          skillKey: "typescript",
          score: 32,
          confidence: 0.9,
          sampleSize: 3,
          lastObservedAt: NOW - 7 * 24 * 60 * 60 * 1_000
        }
      ],
      now: NOW
    });

    const react = result.rankedSkills.find((skill) => skill.key === "react");
    const typescript = result.rankedSkills.find((skill) => skill.key === "typescript");
    expect(react).toMatchObject({
      demonstratedScore: 94,
      difficultyAdjustment: "increase"
    });
    expect(react?.coveragePriorityScore ?? Infinity).toBeLessThan(react?.relevanceScore ?? 0);
    expect(typescript).toMatchObject({
      demonstratedScore: 32,
      difficultyAdjustment: "decrease"
    });
    expect(typescript?.coveragePriorityScore ?? 0).toBeGreaterThan(
      typescript?.relevanceScore ?? Infinity
    );
  });

  it("does not mutate the source candidate profile", () => {
    const profile = mixedProfile();
    const before = JSON.parse(JSON.stringify(profile));

    const result = rankCandidateInterviewRelevance({
      profile,
      targetRole: { title: "Frontend Engineer", family: "frontend", source: "declared" },
      now: NOW
    });

    expect(profile).toEqual(before);
    expect(result.profile).not.toBe(profile);
    expect(result.policyVersion).toBe(RELEVANCE_POLICY_VERSION);
  });
});
