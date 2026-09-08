import { describe, expect, it } from "vitest";
import type { SessionBlueprint } from "@/lib/interviews/personalized-plan";
import { personalizedQuestionSlots } from "./personalized-blueprint-runtime";
import {
  buildTechnicalDeepDiveBlueprint,
  technicalDeepDiveQuestionSources
} from "./technical-deep-dive";

function sourceBlueprint(
  kind: "core-technical" | "applied-engineering",
  id: string,
  label: string
): SessionBlueprint {
  return {
    id,
    kind,
    order: kind === "core-technical" ? 2 : 3,
    title: label,
    subtitle: `${label} depth`,
    durationMinutes: 30,
    difficulty: kind === "core-technical" ? "intermediate" : "advanced",
    rationale: `Prioritize ${label} from the candidate evidence.`,
    topics: [
      {
        key: `${kind}-first`,
        label: `${label} first`,
        targetPercent: 50,
        skillKeys: [`${kind}-skill-one`],
        objectives: [`Explain the first ${label} decision`]
      },
      {
        key: `${kind}-second`,
        label: `${label} second`,
        targetPercent: 50,
        skillKeys: [`${kind}-skill-two`],
        objectives: [`Diagnose the second ${label} scenario`]
      }
    ],
    structure: [
      { kind: "core", questionCount: 1, formats: ["spoken"], purpose: "Explain mechanics." },
      { kind: "scenario", questionCount: 1, formats: ["code"], purpose: "Apply judgement." }
    ],
    followUpPolicy: {
      maxPerQuestion: 2,
      probeWeakClaims: true,
      increaseDifficultyAfterStrongAnswer: true,
      stayWithinBlueprintTopics: true
    },
    rubric: [
      {
        key: `${kind}-reasoning`,
        label: `${label} reasoning`,
        weightPercent: 50,
        strongSignals: ["Explains the mechanism and trade-off"],
        weakSignals: ["Only names a tool"]
      },
      {
        key: `${kind}-judgement`,
        label: `${label} judgement`,
        weightPercent: 50,
        strongSignals: ["Uses evidence to choose a safe response"],
        weakSignals: ["Guesses without verification"]
      }
    ]
  };
}

describe("Technical Deep Dive runtime blueprint", () => {
  it("creates a deterministic four-question Core and Applied arc", () => {
    const core = sourceBlueprint(
      "core-technical",
      "11111111-1111-4111-8111-111111111111",
      "Runtime"
    );
    const applied = sourceBlueprint(
      "applied-engineering",
      "22222222-2222-4222-8222-222222222222",
      "Production"
    );

    const first = buildTechnicalDeepDiveBlueprint(core, applied);
    const replay = buildTechnicalDeepDiveBlueprint(core, applied);
    const slots = personalizedQuestionSlots(first, 4);
    const sources = technicalDeepDiveQuestionSources(core, applied);

    expect(replay).toEqual(first);
    expect(first).toMatchObject({
      kind: "core-technical",
      order: 2,
      title: "Technical Deep Dive",
      durationMinutes: 25,
      difficulty: "advanced"
    });
    expect(slots).toHaveLength(4);
    expect(slots.map((slot) => slot.topic.label)).toEqual([
      "Core · Runtime first",
      "Applied · Production first",
      "Core · Runtime second",
      "Applied · Production second"
    ]);
    expect(slots.map((slot) => slot.topic.skillKeys[0])).toEqual([
      "core-technical-skill-one",
      "applied-engineering-skill-one",
      "core-technical-skill-two",
      "applied-engineering-skill-two"
    ]);
    expect(sources).toEqual([
      expect.objectContaining({
        blueprintId: core.id,
        blueprintKind: "core-technical",
        topicKey: "core-technical-first"
      }),
      expect.objectContaining({
        blueprintId: applied.id,
        blueprintKind: "applied-engineering",
        topicKey: "applied-engineering-first"
      }),
      expect.objectContaining({
        blueprintId: core.id,
        blueprintKind: "core-technical",
        topicKey: "core-technical-second"
      }),
      expect.objectContaining({
        blueprintId: applied.id,
        blueprintKind: "applied-engineering",
        topicKey: "applied-engineering-second"
      })
    ]);
  });

  it("rejects the wrong source kinds", () => {
    const core = sourceBlueprint(
      "core-technical",
      "11111111-1111-4111-8111-111111111111",
      "Runtime"
    );

    expect(() => buildTechnicalDeepDiveBlueprint(core, core)).toThrow(
      "Technical Deep Dive requires Core Technical and Applied Engineering sources"
    );
  });
});
