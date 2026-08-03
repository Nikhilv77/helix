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

describe("InterviewPlanner", () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns a complete role-specific fallback plan", () => {
    const plan = createFallbackPlan(setup);

    expect(plan).toHaveLength(4);
    expect(plan[1].text).toContain("reliability or data-flow");
    expect(plan.filter((question) => question.kind === "code")).toHaveLength(1);
    expect(plan[2]).toMatchObject({
      kind: "code",
      language: "typescript",
      competency: "Practical engineering"
    });
    expect(plan[2]?.codeSnippet).toContain("capturePayment");
    expect(plan.every((question) => question.mustHit.length >= 2)).toBe(true);
  });

  it("does not inject code into a behavioral interview", () => {
    const plan = createFallbackPlan({ ...setup, roundType: "behavioral" });

    expect(plan.every((question) => question.kind === "conversation")).toBe(true);
    expect(plan.every((question) => !question.codeSnippet)).toBe(true);
  });

  it("falls back quickly when the provider does not respond", async () => {
    const ai = {
      generateStructured: jest.fn(() => new Promise(() => undefined))
    } as unknown as AiService;
    const planner = new InterviewPlanner(ai, 5);

    const plan = await planner.plan(setup);

    expect(plan).toEqual(createFallbackPlan(setup));
  });

  it("plans against a chosen template's agenda instead of the default arc", async () => {
    const prompts: string[] = [];
    const ai = {
      generateStructured: jest.fn((request: { prompt: string }) => {
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
      generateStructured: jest.fn((request: { prompt: string }) => {
        prompts.push(request.prompt);
        return new Promise(() => undefined);
      })
    } as unknown as AiService;

    await new InterviewPlanner(ai, 5).plan(setup);

    expect(prompts[0]).toContain("Examine a failure, constraint, disagreement");
  });
});
