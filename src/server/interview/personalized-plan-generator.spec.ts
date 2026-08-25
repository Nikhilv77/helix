import type { CandidateResume, Role } from "@/lib/shared/types";
import { compileCandidateInterviewProfile } from "./candidate-profile-compiler";
import {
  PersonalizedInterviewPlanGenerator,
  type GeneratePersonalizedInterviewPlanInput
} from "./personalized-plan-generator";

const NOW = Date.UTC(2026, 7, 24, 12);

function resume(overrides: Partial<CandidateResume> = {}): CandidateResume {
  return {
    fileName: "candidate.pdf",
    uploadedAt: NOW,
    confidence: 94,
    fullName: "Test Candidate",
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

function profile(candidateResume: CandidateResume, selectedRole: Role) {
  return compileCandidateInterviewProfile({
    resume: candidateResume,
    selectedRole,
    selectedLevel: "3-5",
    profileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    revision: 2,
    generatedAt: NOW
  });
}

function generate(input: Omit<GeneratePersonalizedInterviewPlanInput, "generatedAt">) {
  return new PersonalizedInterviewPlanGenerator().generate({ ...input, generatedAt: NOW });
}

function expectValidBlueprintWeights(plan: ReturnType<typeof generate>["plan"]): void {
  expect(plan.sessions.map((session) => session.kind)).toEqual([
    "problem-solving",
    "core-technical",
    "applied-engineering",
    "architecture-system-design",
    "final-mock"
  ]);
  expect(plan.sessions.map((session) => session.order)).toEqual([1, 2, 3, 4, 5]);
  for (const session of plan.sessions) {
    expect(session.topics.reduce((total, topic) => total + topic.targetPercent, 0)).toBe(100);
    expect(session.rubric.reduce((total, dimension) => total + dimension.weightPercent, 0)).toBe(
      100
    );
    expect(new Set(session.topics.map((topic) => topic.key)).size).toBe(session.topics.length);
  }
}

describe("PersonalizedInterviewPlanGenerator stack personalization", () => {
  it("creates the expected PHP and Laravel progression", () => {
    const candidate = profile(
      resume({
        skills: ["PHP", "Laravel", "MySQL", "Redis", "Docker"],
        experience: [
          {
            organization: "Commerce Co",
            role: "Backend Engineer",
            period: "Jan 2022 - Present",
            location: "",
            summary: "Built production commerce APIs.",
            achievements: ["Improved checkout reliability."],
            skills: ["PHP", "Laravel", "MySQL", "Redis", "Docker"]
          }
        ]
      }),
      "backend"
    );
    const { plan } = generate({
      profile: candidate,
      targetRole: { title: "Laravel Backend Developer", family: "backend", source: "declared" }
    });

    expect(plan.sessions.map((session) => session.title)).toEqual([
      "Problem Solving · PHP",
      "PHP & Laravel Deep Dive",
      "Backend Engineering",
      "Backend System Design",
      "Laravel Backend Mock"
    ]);
    expect(plan.status).toBe("draft");
    expectValidBlueprintWeights(plan);
  });

  it("creates an AI and RAG plan grounded in the highest-ranked technologies", () => {
    const candidate = profile(
      resume({
        skills: [
          "Python",
          "LLMs",
          "RAG",
          "FastAPI",
          "LangChain",
          "PostgreSQL",
          "Vector Databases",
          "AWS",
          "Docker"
        ],
        experience: [
          {
            organization: "Knowledge Co",
            role: "AI Engineer",
            period: "Jan 2023 - Present",
            location: "",
            summary: "Built retrieval and document-processing services.",
            achievements: ["Improved grounded answer quality."],
            skills: ["Python", "LLMs", "RAG", "FastAPI", "LangChain", "Vector Databases"]
          }
        ],
        projects: [
          {
            name: "RAG knowledge assistant",
            summary: "Built document retrieval, ranking, and grounded generation workflows.",
            outcome: "Reduced internal search time.",
            skills: ["Python", "LLMs", "RAG", "LangChain", "Vector Databases"]
          }
        ]
      }),
      "ai-ml"
    );
    const { plan } = generate({
      profile: candidate,
      targetRole: {
        title: "AI Engineer",
        family: "ai-ml",
        source: "declared",
        skillPriorities: [
          { key: "llm", importance: 1 },
          { key: "rag", importance: 1 }
        ]
      }
    });

    expect(plan.sessions.map((session) => session.title)).toEqual([
      "Problem Solving · Python",
      "LLM & RAG Engineering",
      "Applied AI Engineering",
      "AI System Design",
      "AI Engineer Mock"
    ]);
    expect(plan.sessions[1]?.topics.map((topic) => topic.key)).toEqual(
      expect.arrayContaining(["llm", "rag"])
    );
    expect(plan.sessions[2]?.subtitle).toContain("RAG knowledge assistant");
    expectValidBlueprintWeights(plan);
  });

  it("splits a Java and React full-stack profile into frontend and backend sessions", () => {
    const candidate = profile(
      resume({
        skills: ["Java", "Spring Boot", "React", "TypeScript", "PostgreSQL", "Docker"],
        experience: [
          {
            organization: "Product Co",
            role: "Full Stack Engineer",
            period: "Jan 2021 - Present",
            location: "",
            summary: "Built a React frontend and Spring Boot APIs.",
            achievements: ["Owned product delivery across the stack."],
            skills: ["Java", "Spring Boot", "React", "TypeScript", "PostgreSQL", "Docker"]
          }
        ]
      }),
      "fullstack"
    );
    const { plan } = generate({
      profile: candidate,
      targetRole: {
        title: "Java React Full Stack Engineer",
        family: "fullstack",
        source: "declared",
        skillPriorities: [
          { key: "java", importance: 1 },
          { key: "react", importance: 1 }
        ]
      }
    });

    expect(plan.sessions.map((session) => session.title)).toEqual([
      "Problem Solving · Java",
      "React & Frontend Engineering",
      "Java & Spring Boot",
      "Full Stack System Design",
      "Full Stack Mock"
    ]);
    expect(plan.sessions[1]?.topics.map((topic) => topic.key)).toContain("react");
    expect(plan.sessions[2]?.topics.map((topic) => topic.key)).toEqual(
      expect.arrayContaining(["java", "spring-boot"])
    );
    expectValidBlueprintWeights(plan);
  });
});

describe("PersonalizedInterviewPlanGenerator source and adaptation policy", () => {
  it("records JD and performance revisions and adapts difficulty from demonstrated strength", () => {
    const candidate = profile(
      resume({
        skills: ["Python", "LLMs", "RAG"],
        experience: [
          {
            organization: "AI Co",
            role: "AI Engineer",
            period: "Jan 2023 - Present",
            location: "",
            summary: "Built LLM evaluation and retrieval workflows.",
            achievements: [],
            skills: ["Python", "LLMs", "RAG"]
          }
        ]
      }),
      "ai-ml"
    );
    const { plan, relevance } = generate({
      profile: candidate,
      targetRole: { title: "AI Engineer", family: "ai-ml", source: "job-description" },
      jobDescription: {
        snapshot: {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          revision: 3,
          fingerprint: "sha256-job-description"
        },
        relevance: {
          confidence: 1,
          requiredSkills: [
            { key: "llm", importance: 1 },
            { key: "rag", importance: 1 }
          ],
          preferredSkills: [{ key: "python", importance: 0.8 }],
          domainPriorities: [{ key: "applied-ai", importance: 1 }]
        }
      },
      performance: {
        snapshot: { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", revision: 5 },
        skills: [
          {
            skillKey: "llm",
            score: 95,
            confidence: 1,
            sampleSize: 5,
            lastObservedAt: NOW
          },
          {
            skillKey: "rag",
            score: 92,
            confidence: 1,
            sampleSize: 5,
            lastObservedAt: NOW
          }
        ]
      }
    });

    expect(plan.sourceSnapshot).toMatchObject({
      jobDescription: { revision: 3 },
      performanceProfile: { revision: 5 }
    });
    expect(plan.sessions[1]?.difficulty).toBe("advanced");
    expect(plan.sessions[4]?.difficulty).toBe("adaptive");
    expect(relevance.rankedSkills.find((skill) => skill.key === "llm")).toMatchObject({
      difficultyAdjustment: "increase",
      demonstratedScore: 95
    });
  });

  it("still emits a complete, valid roadmap when the resume has sparse technical evidence", () => {
    const candidate = profile(resume({ skills: [] }), "pm");
    const { plan } = generate({
      profile: candidate,
      targetRole: { title: "Product Manager", family: "product", source: "declared" }
    });

    expect(plan.sessions).toHaveLength(5);
    expect(plan.sessions[0]?.title).toBe("Problem Solving · Product");
    expect(plan.rationale).toMatch(/technical evidence is sparse/i);
    expect(plan.sessions.every((session) => session.topics.length > 0)).toBe(true);
    expectValidBlueprintWeights(plan);
  });

  it("carries DSA and behavioral weaknesses into the final mock", () => {
    const candidate = profile(
      resume({
        skills: ["TypeScript", "React"],
        experience: [
          {
            organization: "Product Co",
            role: "Frontend Engineer",
            period: "Jan 2023 - Present",
            location: "",
            summary: "Built React applications.",
            achievements: [],
            skills: ["TypeScript", "React"]
          }
        ]
      }),
      "frontend"
    );
    const { plan } = generate({
      profile: candidate,
      targetRole: { title: "Frontend Engineer", family: "frontend", source: "declared" },
      performance: {
        snapshot: { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", revision: 2 },
        skills: [
          {
            skillKey: "problem-solving",
            score: 48,
            confidence: 0.7,
            sampleSize: 3,
            lastObservedAt: NOW
          },
          {
            skillKey: "dsa-pattern:dynamic-programming",
            score: 38,
            confidence: 0.6,
            sampleSize: 1,
            lastObservedAt: NOW
          },
          {
            skillKey: "behavioral:ownership",
            score: 44,
            confidence: 0.7,
            sampleSize: 3,
            lastObservedAt: NOW
          },
          {
            skillKey: "behavioral:outcome",
            score: 72,
            confidence: 0.7,
            sampleSize: 3,
            lastObservedAt: NOW
          }
        ]
      }
    });
    const finalMock = plan.sessions.find((session) => session.kind === "final-mock");

    expect(finalMock?.topics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "adaptive-problem-solving",
          label: "Problem Solving · Dynamic Programming"
        }),
        expect.objectContaining({
          key: "adaptive-behavioral-ownership",
          label: "Behavioral · Ownership"
        })
      ])
    );
    expect(finalMock?.rationale).toMatch(/demonstrated DSA and behavioral evidence/i);
    expectValidBlueprintWeights(plan);
  });
});
