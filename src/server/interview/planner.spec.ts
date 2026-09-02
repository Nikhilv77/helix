import { AiService } from "../ai/ai.service";
import { Logger } from "../common/logger";
import { InterviewPlanner, createFallbackPlan } from "./planner";
import { InterviewSetup } from "./types";

const setup: InterviewSetup = {
  role: "backend",
  level: "3-5",
  roundType: "technical",
  intensity: "realistic",
  context: "Rebuilt a payments retry pipeline handling delayed webhooks."
};

const dsaSetup: InterviewSetup = {
  ...setup,
  role: "frontend",
  questionCount: 3,
  templateTitle: "DSA practice interview",
  dsaQuestionSlugs: ["two-sum", "coin-change", "number-of-islands"],
  agenda: ["Two Sum: ...", "Coin Change: ...", "Number of Islands: ..."]
};

const personalizedSetup: InterviewSetup = {
  ...setup,
  questionCount: 3,
  personalizedPlanId: "plan-1",
  personalizedBlueprint: {
    id: "blueprint-1",
    kind: "applied-engineering",
    order: 3,
    title: "Applied Backend Engineering",
    subtitle: "Production scenarios",
    durationMinutes: 40,
    difficulty: "intermediate",
    rationale: "The resume repeatedly demonstrates Laravel production work.",
    topics: [
      {
        key: "laravel",
        label: "Laravel",
        targetPercent: 100,
        skillKeys: ["php", "laravel"],
        objectives: ["Handle production failure modes"]
      }
    ],
    structure: [
      {
        kind: "warm-up",
        questionCount: 1,
        formats: ["spoken"],
        purpose: "Establish context."
      },
      {
        kind: "scenario",
        questionCount: 2,
        formats: ["code", "spoken"],
        purpose: "Diagnose production failures."
      }
    ],
    followUpPolicy: {
      maxPerQuestion: 3,
      probeWeakClaims: true,
      increaseDifficultyAfterStrongAnswer: true,
      stayWithinBlueprintTopics: true
    },
    rubric: [
      {
        key: "production-judgement",
        label: "Production judgement",
        weightPercent: 100,
        strongSignals: ["Anticipates failures"],
        weakSignals: ["Only handles the happy path"]
      }
    ]
  }
};

function plannedDsaQuestion(text: string) {
  return {
    text,
    evidenceAnchor: "A problem the model chose to name itself",
    competency: "Algorithmic reasoning",
    intent: "Establish whether the candidate can reason to the approach.",
    mustHit: ["the data structure", "the complexity"],
    probeIfMissing: "What is the time complexity of that?"
  };
}

describe("InterviewPlanner", () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a complete role-specific fallback plan", () => {
    const plan = createFallbackPlan(setup);

    expect(plan).toHaveLength(4);
    expect(plan[1]?.text).toContain("reliability or data-flow");
    expect(plan.filter((question) => question.kind === "code")).toHaveLength(1);
    expect(plan[2]).toMatchObject({
      kind: "code",
      language: "typescript",
      competency: "Practical engineering"
    });
    expect(plan[2]?.codeSnippet).toContain("capturePayment");
    expect(plan.every((question) => question.mustHit.length >= 2)).toBe(true);
    expect(plan.every((question) => question.evidenceAnchor)).toBe(true);
  });

  it("does not inject code into a behavioral interview", () => {
    const plan = createFallbackPlan({ ...setup, roundType: "behavioral" });

    expect(plan.every((question) => question.kind === "conversation")).toBe(true);
    expect(plan.every((question) => !question.codeSnippet)).toBe(true);
  });

  it("builds a DSA fallback from the selected problems", () => {
    const plan = createFallbackPlan(dsaSetup);

    expect(plan).toHaveLength(3);
    expect(plan.map((question) => question.evidenceAnchor)).toEqual([
      "Two Sum",
      "Coin Change",
      "Number of Islands"
    ]);
    expect(plan[0]?.text).toContain("Two Sum");
    expect(plan[0]?.codeTask).toContain("Two Sum");
    // The generic role exercise must never displace a selected problem, or the
    // room asks about React while the workspace shows an algorithm.
    expect(plan.some((question) => question.codeSnippet?.includes("SearchResults"))).toBe(false);
  });

  it("keeps a planned DSA round aligned with the workspace order", async () => {
    const ai = {
      generateStructured: vi.fn(async () => ({
        questions: [
          plannedDsaQuestion("How would you find the two numbers that add to the target?"),
          plannedDsaQuestion("What is the cheapest way to make that amount?"),
          plannedDsaQuestion("How would you count the separate islands in that grid?")
        ]
      }))
    } as unknown as AiService;

    const plan = await new InterviewPlanner(ai).plan(dsaSetup);

    expect(plan.map((question) => question.evidenceAnchor)).toEqual([
      "Two Sum",
      "Coin Change",
      "Number of Islands"
    ]);
    expect(plan.every((question) => question.kind === "code")).toBe(true);
    expect(plan.some((question) => question.codeSnippet)).toBe(false);
  });

  it("plans exact personalized slots and stamps trusted blueprint metadata", async () => {
    const prompts: string[] = [];
    const ai = {
      generateStructured: vi.fn(async (request: { prompt: string }) => {
        prompts.push(request.prompt);
        return {
          questions: [
            plannedDsaQuestion("Where did Laravel carry the most production responsibility?"),
            plannedDsaQuestion("Implement a safe retry path for the failed request."),
            plannedDsaQuestion("How would you diagnose that Laravel failure in production?")
          ]
        };
      })
    } as unknown as AiService;

    const plan = await new InterviewPlanner(ai).plan(personalizedSetup);

    expect(plan).toHaveLength(3);
    expect(plan.map((question) => question.blueprintStage)).toEqual([
      "warm-up",
      "scenario",
      "scenario"
    ]);
    expect(plan[1]).toMatchObject({
      kind: "code",
      language: "php",
      topicKey: "laravel",
      rubricKeys: ["production-judgement"],
      maxFollowUps: 3
    });
    expect(prompts[0]).toContain("persisted personalized interview blueprint");
    expect(prompts[0]).toContain("Produce exactly 3 questions in this exact slot order");
  });

  it("asks the provider for one question per selected problem", async () => {
    const prompts: string[] = [];
    const ai = {
      generateStructured: vi.fn((request: { prompt: string }) => {
        prompts.push(request.prompt);
        return new Promise(() => undefined);
      })
    } as unknown as AiService;

    await new InterviewPlanner(ai, 5).plan(dsaSetup);

    const prompt = prompts[0] ?? "";
    expect(prompt).toContain("DSA coding interview");
    expect(prompt).toContain("1. Two Sum");
    expect(prompt).toContain("exactly 3 questions, one per problem");
    // The resume arc has no place in a round planned from a problem list.
    expect(prompt).not.toContain("Examine a failure, constraint, disagreement");
  });

  it("falls back quickly when the provider does not respond", async () => {
    const ai = {
      generateStructured: vi.fn(() => new Promise(() => undefined))
    } as unknown as AiService;
    const planner = new InterviewPlanner(ai, 5);

    const plan = await planner.plan(setup);

    expect(plan).toEqual(createFallbackPlan(setup));
  });

  it("plans against a chosen template's agenda instead of the default arc", async () => {
    const prompts: string[] = [];
    const ai = {
      generateStructured: vi.fn((request: { prompt: string }) => {
        prompts.push(request.prompt);
        return new Promise(() => undefined);
      })
    } as unknown as AiService;

    await new InterviewPlanner(ai, 5).plan({
      ...setup,
      templateTitle: "Defend your projects",
      agenda: [
        "Establish what the project actually was",
        "Press on one consequential design decision"
      ]
    });

    const prompt = prompts[0] ?? "";
    expect(prompt).toContain("Defend your projects");
    expect(prompt).toContain("1. Establish what the project actually was");
    expect(prompt).toContain("nothing outside it");
    // The generic arc must not survive alongside a chosen agenda.
    expect(prompt).not.toContain("Examine a failure, constraint, disagreement");
  });

  it("keeps the default arc when no template was chosen", async () => {
    const prompts: string[] = [];
    const ai = {
      generateStructured: vi.fn((request: { prompt: string }) => {
        prompts.push(request.prompt);
        return new Promise(() => undefined);
      })
    } as unknown as AiService;

    await new InterviewPlanner(ai, 5).plan(setup);

    expect(prompts[0]).toContain("Examine a failure, constraint, disagreement");
  });

  it("adds conversational resume-defense guidance", async () => {
    const prompts: string[] = [];
    const ai = {
      generateStructured: vi.fn((request: { prompt: string }) => {
        prompts.push(request.prompt);
        return new Promise(() => undefined);
      })
    } as unknown as AiService;

    await new InterviewPlanner(ai, 5).plan({
      ...setup,
      roundType: "behavioral",
      templateId: "resume-behavioral-defense",
      templateTitle: "Resume and Behavioral Defense"
    });

    expect(prompts[0]).toContain("resume-defense round");
    expect(prompts[0]).toContain("relaxed spoken English");
    expect(prompts[0]).toContain("one or two strongest stories");
  });
});
