import type { SessionBlueprint } from "@/lib/interviews/personalized-plan";
import {
  buildPersonalizedBlueprintPrompt,
  createPersonalizedBlueprintFallback,
  personalizedQuestionSlots
} from "./personalized-blueprint-runtime";
import type { InterviewSetup } from "./types";

function blueprint(): SessionBlueprint {
  return {
    id: "blueprint-core",
    kind: "core-technical",
    order: 2,
    title: "PHP & Laravel Deep Dive",
    subtitle: "Mechanisms and trade-offs",
    durationMinutes: 35,
    difficulty: "intermediate",
    rationale: "Laravel is supported by repeated production evidence.",
    topics: [
      {
        key: "laravel",
        label: "Laravel",
        targetPercent: 60,
        skillKeys: ["php", "laravel"],
        objectives: ["Explain framework mechanisms", "Defend implementation trade-offs"]
      },
      {
        key: "postgresql",
        label: "PostgreSQL",
        targetPercent: 40,
        skillKeys: ["sql", "postgresql"],
        objectives: ["Diagnose query and data-model constraints"]
      }
    ],
    structure: [
      {
        kind: "warm-up",
        questionCount: 1,
        formats: ["spoken"],
        purpose: "Establish practical familiarity."
      },
      {
        kind: "core",
        questionCount: 2,
        formats: ["typed", "code"],
        purpose: "Probe mechanisms and trade-offs."
      },
      {
        kind: "scenario",
        questionCount: 2,
        formats: ["spoken", "diagram"],
        purpose: "Apply concepts to production failures."
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
        key: "depth",
        label: "Technical depth",
        weightPercent: 70,
        strongSignals: ["Explains the mechanism", "Names a real constraint"],
        weakSignals: ["Only repeats framework terminology"]
      },
      {
        key: "judgement",
        label: "Engineering judgement",
        weightPercent: 30,
        strongSignals: ["Compares alternatives"],
        weakSignals: ["Treats one choice as universal"]
      }
    ]
  };
}

function setup(): InterviewSetup {
  return {
    role: "backend",
    level: "3-5",
    roundType: "technical",
    intensity: "realistic",
    context: "Built a Laravel order API backed by PostgreSQL.",
    questionCount: 5,
    personalizedPlanId: "plan-1",
    personalizedBlueprint: blueprint()
  };
}

describe("personalized blueprint runtime", () => {
  it("expands stable stages, formats, weighted topics, and follow-up limits", () => {
    const slots = personalizedQuestionSlots(blueprint(), 5);

    expect(slots.map((slot) => slot.stage)).toEqual([
      "warm-up",
      "core",
      "core",
      "scenario",
      "scenario"
    ]);
    expect(slots.map((slot) => slot.format)).toEqual([
      "spoken",
      "typed",
      "code",
      "spoken",
      "diagram"
    ]);
    expect(slots.map((slot) => slot.topic.key)).toEqual([
      "laravel",
      "postgresql",
      "laravel",
      "postgresql",
      "laravel"
    ]);
    expect(slots.every((slot) => slot.maxFollowUps === 3)).toBe(true);
  });

  it("gives the provider an exact, bounded blueprint prompt", () => {
    const prompt = buildPersonalizedBlueprintPrompt(setup());

    expect(prompt).toContain("Produce exactly 5 questions in this exact slot order");
    expect(prompt).toContain("stage=core; topic=PostgreSQL; response=typed");
    expect(prompt).toContain("Technical depth (70%)");
    expect(prompt).toContain("At most 3 follow-ups");
    expect(prompt).toContain("must stay within the allowed topics");
  });

  it("creates an exact fallback and preserves trusted presentation metadata", () => {
    const questions = createPersonalizedBlueprintFallback(setup());

    expect(questions).toHaveLength(5);
    expect(questions[2]).toMatchObject({
      kind: "code",
      answerFormat: "typed",
      language: "php",
      blueprintStage: "core",
      blueprintFormat: "code",
      blueprintDifficulty: "intermediate",
      topicKey: "laravel",
      skillKeys: ["php", "laravel"],
      maxFollowUps: 3
    });
    expect(questions.every((question) => question.mustHit.length >= 2)).toBe(true);
  });
});
