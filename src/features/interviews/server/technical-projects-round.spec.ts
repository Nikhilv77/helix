import { describe, expect, it } from "vitest";
import type { SessionBlueprint } from "@/features/interviews/domain/personalized-plan";
import type { CandidateProfile } from "@/lib/shared/types";
import {
  buildTechnicalProjectsPlan,
  selectGroundedProjectSource,
  selectTechnicalProjectMcqs
} from "./technical-projects-round";

function blueprint(kind: "core-technical" | "applied-engineering"): SessionBlueprint {
  return {
    id: `${kind}-blueprint`,
    kind,
    order: kind === "core-technical" ? 2 : 3,
    title: kind,
    subtitle: "depth",
    durationMinutes: 35,
    difficulty: "intermediate",
    rationale: "test",
    topics: [
      {
        key: `${kind}-topic`,
        label: kind,
        targetPercent: 100,
        skillKeys: kind === "core-technical" ? ["javascript"] : ["nodejs"],
        objectives: ["Explain the mechanism"]
      }
    ],
    structure: [{ kind: "core", questionCount: 1, formats: ["spoken"], purpose: "test" }],
    followUpPolicy: {
      maxPerQuestion: 2,
      probeWeakClaims: true,
      increaseDifficultyAfterStrongAnswer: true,
      stayWithinBlueprintTopics: true
    },
    rubric: [
      {
        key: "reasoning",
        label: "Reasoning",
        weightPercent: 100,
        strongSignals: ["Explains why"],
        weakSignals: ["Only names a tool"]
      }
    ]
  };
}

const profile = {
  targetRole: "backend",
  level: "3-5",
  targetCompany: "",
  targetDate: null,
  headline: "Engineer",
  context: "Backend engineer",
  focusAreas: [],
  stories: [],
  coverImage: null,
  profileImage: null,
  workspaceAccent: "cyan",
  teacherId: null,
  helpNotificationsEnabled: true,
  teacherNotificationsEnabled: true,
  updatedAt: 0,
  completeness: 100,
  onboardingCompletedAt: 1,
  preparationOnboarding: null,
  resume: {
    fileName: "resume.pdf",
    mimeType: "application/pdf",
    uploadedAt: 1,
    confidence: 1,
    fullName: "Candidate",
    headline: "Engineer",
    context: "Backend engineer",
    skills: ["JavaScript", "Node.js"],
    warnings: [],
    experience: [],
    education: [],
    certifications: [],
    projects: [
      {
        name: "Ledger Guard",
        summary: "Built a replay-safe payment service.",
        outcome: "Reduced duplicate captures.",
        skills: ["Node.js", "PostgreSQL"]
      }
    ],
    achievements: [],
    practiceQuestions: [],
    roadmap: [],
    document: { pageCount: 1, wordCount: 50 },
    evidence: {
      sections: ["projects"],
      dateRanges: 0,
      achievementLines: 0,
      quantifiedAchievements: 0,
      experienceEntries: 0,
      projectEntries: 1,
      educationEntries: 0
    },
    interviewKit: null
  }
} as unknown as CandidateProfile;

describe("Core Technical & Projects frozen plan", () => {
  it("builds three deterministic MCQs followed by four acts on one project", () => {
    const core = blueprint("core-technical");
    const applied = blueprint("applied-engineering");
    const mcqs = selectTechnicalProjectMcqs({ kit: null, coreBlueprint: core, level: "3-5" });
    const project = selectGroundedProjectSource({
      profile,
      coreBlueprint: core,
      appliedBlueprint: applied
    });
    const plan = buildTechnicalProjectsPlan({
      coreBlueprint: core,
      appliedBlueprint: applied,
      mcqs,
      project
    });

    expect(plan).toHaveLength(7);
    expect(plan.slice(0, 3).every((question) => question.kind === "mcq")).toBe(true);
    expect(plan.slice(3).map((question) => question.projectAct)).toEqual([
      "context",
      "mechanism",
      "failure",
      "tradeoffs"
    ]);
    expect(
      plan.slice(3).every((question) => question.topicKey === "project:resume-project-1")
    ).toBe(true);
    expect(plan.slice(3).every((question) => question.maxFollowUps === 2)).toBe(true);
  });

  it("prefers relevant resume projects and falls back without inventing ownership", () => {
    const core = blueprint("core-technical");
    const applied = blueprint("applied-engineering");
    const project = selectGroundedProjectSource({
      profile,
      coreBlueprint: core,
      appliedBlueprint: applied
    });
    expect(project).toMatchObject({ sourceKind: "project", name: "Ledger Guard" });

    const withoutResume = { ...profile, resume: null };
    const fallback = selectGroundedProjectSource({
      profile: withoutResume,
      coreBlueprint: core,
      appliedBlueprint: applied
    });
    expect(fallback.sourceKind).toBe("scenario");
  });
});
