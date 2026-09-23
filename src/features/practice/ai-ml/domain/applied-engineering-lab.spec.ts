import { describe, expect, it } from "vitest";
import { appliedEngineeringLab } from "./applied-engineering-lab";
import {
  interactiveResponseError,
  practiceInteractionSchema,
  scoreInteractiveResponse,
  type InteractiveResponse
} from "@/features/practice/shared/domain/interactive-response";
import { interactivePracticeAttemptInputSchema } from "@/features/practice/shared/domain/story-practice-contracts";
import { evaluateInteractiveResponse } from "@/features/practice/shared/server/interactive-evaluator";

const solutions: InteractiveResponse[] = [
  { type: "sequence", order: ["contain", "verify", "diagnose", "replay", "canary"] },
  {
    type: "classification",
    assignments: {
      index: "coverage",
      prompt: "generation",
      cache: "freshness",
      deadline: "serving"
    }
  },
  { type: "configuration", values: { threshold: 0.4, reviews: 150, recall: 90, precision: 60 } },
  {
    type: "classification",
    assignments: { late: "leakage", units: "skew", stale: "freshness", default: "valid" }
  },
  { type: "sequence", order: ["audit", "objective", "fit", "tune", "test"] },
  { type: "configuration", values: { timeout: 500, retries: 0, batch: 8 } }
];

describe("Applied Engineering production lab", () => {
  it.each(
    appliedEngineeringLab.questions.map((question, index) => ({
      question,
      response: solutions[index]!
    }))
  )("validates and grades the complete solution to $question.id", ({ question, response }) => {
    const interaction = practiceInteractionSchema.parse(question.interaction);
    expect(interactiveResponseError(interaction, response, true)).toBeNull();
    const result = evaluateInteractiveResponse(response, question.interactionRubric!, {
      explanation: question.answer.explanation,
      consequence: question.interviewConnection,
      followUp: question.interviewerFollowUps[0]!
    });
    expect(result.score).toBe(10);
    expect(result.missedEdgeCases).toEqual([]);
    expect(question.interactionRubric!.reduce((sum, criterion) => sum + criterion.points, 0)).toBe(
      10
    );
    expect(
      new Set(
        interaction.type === "configuration"
          ? interaction.fields.map((f) => f.id)
          : interaction.items.map((f) => f.id)
      ).size
    ).toBe(
      interaction.type === "configuration" ? interaction.fields.length : interaction.items.length
    );
  });

  it("accepts independent evaluation prerequisites in either order", () => {
    const response: InteractiveResponse = {
      type: "sequence",
      order: ["objective", "audit", "fit", "tune", "test"]
    };
    expect(
      scoreInteractiveResponse(response, appliedEngineeringLab.questions[4]!.interactionRubric!)
        .score
    ).toBe(10);
  });

  it("gives partial credit and specific corrections for a dangerous retry budget", () => {
    const question = appliedEngineeringLab.questions[5]!;
    const result = evaluateInteractiveResponse(
      { type: "configuration", values: { timeout: 500, retries: 1, batch: 8 } },
      question.interactionRubric!,
      {
        explanation: question.answer.explanation,
        consequence: question.interviewConnection,
        followUp: question.interviewerFollowUps[0]!
      }
    );
    expect(result.score).toBe(7);
    expect(result.missingOrIncorrect).toContain("exceed the 900 ms");
    expect(result.didWell).toContain("Respect peak memory");
  });

  it("allows incomplete drafts but refuses incomplete attempts and foreign IDs", () => {
    const interaction = appliedEngineeringLab.questions[0]!.interaction!;
    expect(
      interactiveResponseError(interaction, { type: "sequence", order: ["contain"] }, false)
    ).toBeNull();
    expect(
      interactiveResponseError(interaction, { type: "sequence", order: ["contain"] }, true)
    ).toContain("every step");
    expect(
      interactiveResponseError(
        interaction,
        { type: "sequence", order: ["contain", "contain"] },
        false
      )
    ).toContain("once");
    expect(
      interactiveResponseError(interaction, { type: "sequence", order: ["invented"] }, false)
    ).not.toBeNull();
    expect(
      interactiveResponseError(interaction, { type: "configuration", values: {} }, false)
    ).not.toBeNull();
  });

  it("rejects unknown categories and out-of-range or fractional request counts", () => {
    expect(
      interactiveResponseError(
        appliedEngineeringLab.questions[1]!.interaction!,
        { type: "classification", assignments: { index: "invented" } },
        false
      )
    ).not.toBeNull();
    const config = appliedEngineeringLab.questions[5]!.interaction!;
    expect(
      interactiveResponseError(config, { type: "configuration", values: { batch: 8.5 } }, false)
    ).toContain("increments");
    expect(
      interactiveResponseError(config, { type: "configuration", values: { timeout: 1000 } }, false)
    ).toContain("between");
  });

  it("rejects client-provided scores and non-finite configuration values at the API boundary", () => {
    const input = {
      questionId: "00000000-0000-4000-8000-000000000001",
      requestId: "00000000-0000-4000-8000-000000000002",
      work: { kind: "interactive", response: solutions[0], score: 10 }
    };
    expect(interactivePracticeAttemptInputSchema.safeParse(input).success).toBe(false);
    expect(
      interactivePracticeAttemptInputSchema.safeParse({
        ...input,
        work: {
          kind: "interactive",
          response: { type: "configuration", values: { timeout: Infinity } }
        }
      }).success
    ).toBe(false);
  });
});
