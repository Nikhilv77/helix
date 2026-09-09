import { createHash } from "node:crypto";
import {
  sessionBlueprintSchema,
  type BlueprintDifficulty,
  type SessionBlueprint
} from "@/features/interviews/domain/personalized-plan";
import {
  TECHNICAL_DEEP_DIVE_DURATION_MINUTES,
  TECHNICAL_DEEP_DIVE_TITLE
} from "@/features/interviews/domain/technical-deep-dive";
import {
  personalizedQuestionSlots,
  type PersonalizedQuestionSlot
} from "./personalized-blueprint-runtime";

interface SourceSlot {
  source: "core-technical" | "applied-engineering";
  slot: PersonalizedQuestionSlot;
}

export interface TechnicalDeepDiveQuestionSource {
  blueprintId: string;
  blueprintKind: SourceSlot["source"];
  topicKey: string;
  rubricKeys: string[];
}

/**
 * Builds one immutable four-question runtime blueprint from the current Core
 * and Applied blueprints. The public plan keeps both stable source slots; only
 * the launched interview gets this derived projection.
 */
export function buildTechnicalDeepDiveBlueprint(
  core: SessionBlueprint,
  applied: SessionBlueprint
): SessionBlueprint {
  const sourceSlots = sourceSlotsFor(core, applied);
  const fingerprint = createHash("sha256")
    .update(`${core.id}:${applied.id}`)
    .digest("hex")
    .slice(0, 32);

  return sessionBlueprintSchema.parse({
    id: `technical-deep-dive-${fingerprint}`,
    kind: "core-technical",
    order: 2,
    title: TECHNICAL_DEEP_DIVE_TITLE,
    subtitle: "Core mechanisms and applied production judgement in one focused round.",
    durationMinutes: TECHNICAL_DEEP_DIVE_DURATION_MINUTES,
    difficulty: harderDifficulty(core.difficulty, applied.difficulty),
    rationale: compact(
      `This round combines the active Core Technical blueprint (${core.rationale}) with the active Applied Engineering blueprint (${applied.rationale}).`,
      1_000
    ),
    topics: sourceSlots.map(({ source, slot }, index) => ({
      key: derivedKey("topic", source, index, slot.topic.key),
      label: compact(`${sourceLabel(source)} · ${slot.topic.label}`, 160),
      targetPercent: 25,
      skillKeys: [...slot.topic.skillKeys],
      objectives: [slot.objective]
    })),
    structure: sourceSlots.map(({ source, slot }) => ({
      kind: slot.stage,
      questionCount: 1,
      formats: [slot.format],
      purpose: compact(`${sourceLabel(source)}: ${slot.stagePurpose}`, 700)
    })),
    followUpPolicy: {
      maxPerQuestion: Math.max(
        core.followUpPolicy.maxPerQuestion,
        applied.followUpPolicy.maxPerQuestion
      ),
      probeWeakClaims:
        core.followUpPolicy.probeWeakClaims || applied.followUpPolicy.probeWeakClaims,
      increaseDifficultyAfterStrongAnswer:
        core.followUpPolicy.increaseDifficultyAfterStrongAnswer ||
        applied.followUpPolicy.increaseDifficultyAfterStrongAnswer,
      stayWithinBlueprintTopics: true
    },
    rubric: sourceSlots.map(({ source, slot }, index) => {
      const dimension =
        sourceBlueprint(source, core, applied).rubric.find((item) =>
          slot.rubricKeys.includes(item.key)
        ) ?? sourceBlueprint(source, core, applied).rubric[0]!;
      return {
        key: derivedKey("rubric", source, index, dimension.key),
        label: compact(`${sourceLabel(source)} · ${dimension.label}`, 160),
        weightPercent: 25,
        strongSignals: [...dimension.strongSignals],
        weakSignals: [...dimension.weakSignals]
      };
    })
  });
}

/** Original source metadata, ordered exactly like the derived runtime slots. */
export function technicalDeepDiveQuestionSources(
  core: SessionBlueprint,
  applied: SessionBlueprint
): TechnicalDeepDiveQuestionSource[] {
  return sourceSlotsFor(core, applied).map(({ source, slot }) => ({
    blueprintId: sourceBlueprint(source, core, applied).id,
    blueprintKind: source,
    topicKey: slot.topic.key,
    rubricKeys: [...slot.rubricKeys]
  }));
}

function sourceSlotsFor(core: SessionBlueprint, applied: SessionBlueprint): SourceSlot[] {
  if (core.kind !== "core-technical" || applied.kind !== "applied-engineering") {
    throw new Error("Technical Deep Dive requires Core Technical and Applied Engineering sources");
  }

  const coreSlots = repeatToTwo(personalizedQuestionSlots(core, 2));
  const appliedSlots = repeatToTwo(personalizedQuestionSlots(applied, 2));
  return [
    { source: "core-technical", slot: coreSlots[0] },
    { source: "applied-engineering", slot: appliedSlots[0] },
    { source: "core-technical", slot: coreSlots[1] },
    { source: "applied-engineering", slot: appliedSlots[1] }
  ];
}

function repeatToTwo(
  slots: PersonalizedQuestionSlot[]
): [PersonalizedQuestionSlot, PersonalizedQuestionSlot] {
  const first = slots[0];
  if (!first)
    throw new Error("A Technical Deep Dive source blueprint must contain a question slot");
  return [first, slots[1] ?? first];
}

function sourceBlueprint(
  source: SourceSlot["source"],
  core: SessionBlueprint,
  applied: SessionBlueprint
) {
  return source === "core-technical" ? core : applied;
}

function sourceLabel(source: SourceSlot["source"]) {
  return source === "core-technical" ? "Core" : "Applied";
}

function derivedKey(prefix: string, source: SourceSlot["source"], index: number, value: string) {
  const suffix = createHash("sha256").update(value).digest("hex").slice(0, 12);
  return `${prefix}-${source}-${index + 1}-${suffix}`;
}

function harderDifficulty(
  left: BlueprintDifficulty,
  right: BlueprintDifficulty
): BlueprintDifficulty {
  const rank: Record<BlueprintDifficulty, number> = {
    foundational: 0,
    intermediate: 1,
    advanced: 2,
    adaptive: 3
  };
  return rank[left] >= rank[right] ? left : right;
}

function compact(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 1)}…`;
}
