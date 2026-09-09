import { buildDecidePrompt } from "./decider";
import type { DecideInput } from "./decider";

const input: DecideInput = {
  setup: {
    role: "frontend",
    level: "3-5",
    roundType: "behavioral",
    intensity: "realistic",
    context: "Built a checkout flow.",
    templateId: "resume-behavioral-defense",
    templateTitle: "Resume and Behavioral Defense"
  },
  questionAsked: "What did you personally own in that checkout work?",
  evidenceAnchor: "Checkout flow retry handling",
  competency: "Ownership",
  intent: "Separate personal contribution from team work.",
  mustHit: ["personal responsibility", "specific implementation"],
  userAnswer: "I owned the retry flow and the error states.",
  followUpCount: 0,
  conversationHistory: []
};

describe("resume interview decider prompt", () => {
  it("asks Maya to balance natural follow-ups with moving on", () => {
    const prompt = buildDecidePrompt(input);

    expect(prompt).toContain("resume-defense conversation");
    expect(prompt).toContain("Do not counter every answer");
    expect(prompt).toContain("Never manufacture a follow-up");
    expect(prompt).toContain("simple spoken phrasing");
    expect(prompt).toContain("single missing link in this evidence chain");
    expect(prompt).toContain("Checkout flow retry handling");
  });

  it("gives Maya the evidence already established", () => {
    const prompt = buildDecidePrompt({
      ...input,
      evidenceLedger: {
        ownership: ["I owned the retry flow."],
        decision: ["I chose idempotency keys because retries could duplicate charges."],
        specificity: ["The flow used Redis and PayU."],
        outcome: [],
        gaps: ["outcome"]
      }
    });

    expect(prompt).toContain("Personal ownership: I owned the retry flow.");
    expect(prompt).toContain("Decision or trade-off: I chose idempotency keys");
    expect(prompt).toContain("Current gaps: outcome");
    expect(prompt).toContain("do not ask for these again");
  });

  it("bounds personalized follow-ups to the assigned topic and rubric", () => {
    const prompt = buildDecidePrompt({
      ...input,
      maxFollowUps: 3,
      topicLabel: "Laravel",
      blueprintDifficulty: "intermediate",
      rubric: [
        {
          key: "depth",
          label: "Technical depth",
          weightPercent: 100,
          strongSignals: ["Explains the request lifecycle"],
          weakSignals: ["Only names framework features"]
        }
      ],
      followUpPolicy: {
        maxPerQuestion: 3,
        probeWeakClaims: true,
        increaseDifficultyAfterStrongAnswer: true,
        stayWithinBlueprintTopics: true
      }
    });

    expect(prompt).toContain("Assigned topic: Laravel");
    expect(prompt).toContain("Technical depth: strong=Explains the request lifecycle");
    expect(prompt).toContain("Stay within the assigned topic");
    expect(prompt).toContain("0 of 3");
  });
});
