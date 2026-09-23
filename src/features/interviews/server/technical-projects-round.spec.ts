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
  it("uses authored AI/ML questions for an AI/ML target even with a generic blueprint", () => {
    const core = blueprint("core-technical");

    const questions = selectTechnicalProjectMcqs({
      kit: null,
      coreBlueprint: core,
      level: "0-2",
      targetRole: "ai-ml"
    });

    expect(questions).toHaveLength(3);
    expect(questions.every((question) => question.sourceId.startsWith("ai-ml-core:"))).toBe(true);
    expect(questions[0]?.prompt).toContain("model");
  });

  it("uses an AI/ML production scenario and Python evaluation task in the combined round", () => {
    const core = blueprint("core-technical");
    const applied = blueprint("applied-engineering");
    const mcqs = selectTechnicalProjectMcqs({
      kit: null,
      coreBlueprint: core,
      level: "0-2",
      targetRole: "ai-ml"
    });
    const project = selectGroundedProjectSource({
      profile,
      coreBlueprint: core,
      appliedBlueprint: applied
    });

    const plan = buildTechnicalProjectsPlan({
      coreBlueprint: core,
      appliedBlueprint: applied,
      mcqs,
      project,
      targetRole: "ai-ml"
    });

    expect(plan).toHaveLength(7);
    expect(plan[5]).toMatchObject({
      kind: "conversation",
      competency: "Applied AI production diagnosis",
      projectAct: "failure",
      topicKey: `project:${project.sourceId}`
    });
    expect(plan[6]).toMatchObject({
      kind: "code",
      language: "python",
      codeTask: expect.stringContaining("accuracy by segment")
    });
  });

  it("builds three deterministic MCQs, three project prompts, and project coding", () => {
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
      "coding"
    ]);
    expect(
      plan.slice(3).every((question) => question.topicKey === "project:resume-project-1")
    ).toBe(true);
    expect(plan.slice(3, 6).every((question) => question.maxFollowUps === 2)).toBe(true);
    expect(plan[6]).toMatchObject({
      kind: "code",
      stage: "code",
      answerFormat: "typed",
      language: "javascript",
      projectAct: "coding",
      maxFollowUps: 1
    });
    expect(plan[6]?.text).toContain("Ledger Guard");
    expect(plan[6]?.codeTask).toContain("Ledger Guard");
    expect(plan[6]?.codeSnippet).toContain("applyProjectRule");
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

  it("uses a resume coding task only when its skill belongs to the selected project", () => {
    const core = blueprint("core-technical");
    const applied = blueprint("applied-engineering");
    const mcqs = selectTechnicalProjectMcqs({ kit: null, coreBlueprint: core, level: "3-5" });
    const project = selectGroundedProjectSource({
      profile,
      coreBlueprint: core,
      appliedBlueprint: applied
    });
    const matchingTask = {
      skill: "Node.js",
      language: "javascript",
      title: "Retry guard",
      brief: "Implement a replay-safe handler.",
      starterCode: "function handle(event) {\n  // TODO\n}",
      expects: ["deduplicates retries", "validates input"]
    };

    const matchingPlan = buildTechnicalProjectsPlan({
      coreBlueprint: core,
      appliedBlueprint: applied,
      mcqs,
      project,
      codingTask: matchingTask
    });
    expect(matchingPlan[6]).toMatchObject({
      language: "javascript",
      codeSnippet: matchingTask.starterCode
    });
    expect(matchingPlan[6]?.codeTask).toContain(matchingTask.brief);

    const unrelatedPlan = buildTechnicalProjectsPlan({
      coreBlueprint: core,
      appliedBlueprint: applied,
      mcqs,
      project,
      codingTask: { ...matchingTask, skill: "React", title: "Debounce UI input" }
    });
    expect(unrelatedPlan[6]?.text).not.toContain("Debounce UI input");
    expect(unrelatedPlan[6]?.codeTask).toContain("Ledger Guard");
  });

  it("keeps AI/ML coding in Python even when the resume contains a matching JavaScript task", () => {
    const core = blueprint("core-technical");
    const applied = blueprint("applied-engineering");
    const project = selectGroundedProjectSource({
      profile,
      coreBlueprint: core,
      appliedBlueprint: applied
    });
    const plan = buildTechnicalProjectsPlan({
      coreBlueprint: core,
      appliedBlueprint: applied,
      mcqs: selectTechnicalProjectMcqs({
        kit: null,
        coreBlueprint: core,
        level: "0-2",
        targetRole: "ai-ml"
      }),
      project,
      targetRole: "ai-ml",
      codingTask: {
        skill: "Node.js",
        language: "javascript",
        title: "Retry guard",
        brief: "Implement a replay-safe JavaScript handler.",
        starterCode: "function handle(event) {}",
        expects: ["deduplicates retries"]
      }
    });

    expect(plan[6]).toMatchObject({
      language: "python",
      codeSnippet: expect.stringContaining("def evaluate_predictions"),
      codeTask: expect.stringContaining("accuracy by segment")
    });
    expect(plan[6]?.codeTask).not.toContain("JavaScript handler");
  });
});
