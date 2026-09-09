import type { CandidateResume } from "@/lib/shared/types";
import { compileCandidateInterviewProfile, normalizeSkill } from "./candidate-profile-compiler";

const GENERATED_AT = Date.UTC(2026, 7, 24);

function resume(overrides: Partial<CandidateResume> = {}): CandidateResume {
  return {
    fileName: "candidate.pdf",
    uploadedAt: GENERATED_AT,
    confidence: 92,
    fullName: "Asha Candidate",
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

describe("normalizeSkill", () => {
  it.each([
    ["React", "react", "React"],
    ["React.js", "react", "React"],
    ["reactJS", "react", "React"],
    ["Node.js", "nodejs", "Node.js"],
    ["Postgres", "postgresql", "PostgreSQL"],
    ["C#", "c-sharp", "C#"],
    ["C Programming", "c", "C"],
    ["Golang", "go", "Go"],
    ["RStudio", "r", "R"],
    ["Retrieval Augmented Generation", "rag", "Retrieval-Augmented Generation"]
  ])("normalizes %s to canonical skill %s", (raw, key, label) => {
    expect(normalizeSkill(raw)).toMatchObject({ key, label });
  });

  it("preserves an unknown technology with a stable fallback key", () => {
    expect(normalizeSkill("Temporal Cloud SDK")).toEqual({
      key: "temporal-cloud-sdk",
      label: "Temporal Cloud SDK",
      category: "cloud",
      roleFamilies: []
    });
  });
});

describe("compileCandidateInterviewProfile", () => {
  it("builds an evidence-backed AI/backend profile from an LLM resume", () => {
    const candidateResume = resume({
      skills: ["Python", "LLMs", "RAG", "Fast API", "Postgres", "Vector DB", "AWS", "Docker"],
      experience: [
        {
          organization: "Knowledge Labs",
          role: "AI Engineer",
          period: "Jan 2023 - Jun 2025",
          location: "Remote",
          summary: "Built retrieval and document-processing APIs for an enterprise assistant.",
          achievements: ["Reduced unsupported answers by 31%."],
          skills: ["Python 3", "FastAPI", "LangChain", "PostgreSQL", "AWS", "Docker"]
        }
      ],
      projects: [
        {
          name: "RAG knowledge assistant",
          summary: "Implemented chunking, retrieval, reranking, and grounded generation.",
          outcome: "Cut internal search time substantially.",
          skills: ["Python", "RAG", "LLM", "LangChain", "Vector Databases"]
        }
      ]
    });

    const profile = compileCandidateInterviewProfile({
      resume: candidateResume,
      selectedRole: "ai-ml",
      selectedLevel: "3-5",
      generatedAt: GENERATED_AT,
      profileId: "profile-asha"
    });

    expect(profile.inferredRole).toMatchObject({
      family: "ai-ml",
      title: "AI / Backend Engineer"
    });
    expect(profile.experience).toMatchObject({ estimatedYears: 2.5, band: "mid" });
    expect(profile.domains.map((domain) => domain.key)).toContain("applied-ai");
    expect(profile.importantProjects[0]).toMatchObject({
      name: "RAG knowledge assistant",
      skillKeys: expect.arrayContaining(["python", "rag", "llm", "langchain"])
    });

    const python = profile.skills.find((skill) => skill.key === "python");
    expect(python).toMatchObject({ primary: true });
    expect(python?.aliases).toContain("Python 3");
    expect(python?.evidence.map((item) => item.sourceKind)).toEqual([
      "skills-section",
      "work-experience",
      "project"
    ]);
    expect(python?.relevance.score).toBeGreaterThan(60);
  });

  it("deduplicates aliases while retaining every source of evidence", () => {
    const profile = compileCandidateInterviewProfile({
      resume: resume({
        skills: ["React.js"],
        experience: [
          {
            organization: "Web Co",
            role: "Frontend Engineer",
            period: "2024 - Present",
            location: "",
            summary: "Shipped a React dashboard.",
            achievements: [],
            skills: ["React", "ReactJS"]
          }
        ],
        projects: [
          {
            name: "Admin portal",
            summary: "Built a component-driven admin portal.",
            outcome: "",
            skills: ["React JS"]
          }
        ]
      }),
      generatedAt: GENERATED_AT
    });

    expect(profile.skills.filter((skill) => skill.key === "react")).toHaveLength(1);
    const react = profile.skills.find((skill) => skill.key === "react");
    expect(react?.evidence).toHaveLength(3);
    expect(react?.evidence.find((item) => item.sourceKind === "work-experience")?.occurrences).toBe(
      2
    );
  });

  it("infers Laravel backend and Java/React full-stack profiles without stack-specific roadmaps", () => {
    const laravel = compileCandidateInterviewProfile({
      resume: resume({
        skills: ["PHP", "Laravel", "MySQL", "Redis"],
        experience: [
          {
            organization: "Commerce Co",
            role: "Backend Developer",
            period: "2021 - Present",
            location: "",
            summary: "Built commerce APIs.",
            achievements: [],
            skills: ["PHP", "Laravel", "MySQL", "Redis"]
          }
        ]
      }),
      generatedAt: GENERATED_AT
    });
    const javaReact = compileCandidateInterviewProfile({
      resume: resume({
        skills: ["Java", "Spring Boot", "React.js", "TypeScript"],
        experience: [
          {
            organization: "Platform Co",
            role: "Full Stack Engineer",
            period: "2022 - Present",
            location: "",
            summary: "Owned React features and Spring services.",
            achievements: [],
            skills: ["Java", "SpringBoot", "React", "TypeScript"]
          }
        ]
      }),
      generatedAt: GENERATED_AT
    });

    expect(laravel.inferredRole.family).toBe("backend");
    expect(laravel.skills.filter((skill) => skill.primary).map((skill) => skill.key)).toEqual(
      expect.arrayContaining(["php", "laravel"])
    );
    expect(javaReact.inferredRole).toMatchObject({
      family: "fullstack",
      title: "Full Stack Engineer"
    });
  });

  it("merges overlapping employment ranges instead of double-counting experience", () => {
    const profile = compileCandidateInterviewProfile({
      resume: resume({
        experience: [
          {
            organization: "A",
            role: "Software Engineer",
            period: "Jan 2022 - Dec 2023",
            location: "",
            summary: "",
            achievements: [],
            skills: ["Java"]
          },
          {
            organization: "B",
            role: "Consulting Engineer",
            period: "Jun 2023 - Dec 2024",
            location: "",
            summary: "",
            achievements: [],
            skills: ["Java"]
          }
        ]
      }),
      generatedAt: GENERATED_AT
    });

    expect(profile.experience).toMatchObject({ estimatedYears: 3, band: "mid" });
  });

  it("marks skills-section-only evidence as non-primary and emits a warning", () => {
    const profile = compileCandidateInterviewProfile({
      resume: resume({ skills: ["React", "Node.js"] }),
      selectedRole: "fullstack",
      selectedLevel: "0-2",
      generatedAt: GENERATED_AT
    });

    expect(profile.skills.every((skill) => !skill.primary)).toBe(true);
    expect(profile.warnings).toContain(
      "Technology evidence comes mainly from the skills section, without job or project support."
    );
    expect(profile.experience).toMatchObject({ estimatedYears: null, band: "junior" });
  });

  it("produces a deterministic fingerprint independent of generation time", () => {
    const candidateResume = resume({ skills: ["Python"] });
    const first = compileCandidateInterviewProfile({
      resume: candidateResume,
      generatedAt: GENERATED_AT
    });
    const second = compileCandidateInterviewProfile({
      resume: candidateResume,
      generatedAt: GENERATED_AT + 10_000
    });

    expect(first.sourceResumeFingerprint).toBe(second.sourceResumeFingerprint);
    expect(first.sourceResumeFingerprint).toMatch(/^sha256-[a-f0-9]{64}$/);
  });
});
