import { z } from "zod";

const id = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9-]+$/);
const item = z.object({ id, label: z.string().min(1).max(500) }).strict();

/** Public controls only. Expected answers and scoring rules stay on the server. */
export const practiceInteractionSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("sequence"),
      instruction: z.string().min(1).max(700),
      items: z.array(item).min(2).max(8)
    })
    .strict(),
  z
    .object({
      type: z.literal("classification"),
      instruction: z.string().min(1).max(700),
      items: z.array(item).min(2).max(8),
      categories: z.array(item).min(2).max(8)
    })
    .strict(),
  z
    .object({
      type: z.literal("configuration"),
      instruction: z.string().min(1).max(700),
      fields: z
        .array(
          z
            .object({
              id,
              label: z.string().min(1).max(160),
              unit: z.string().max(40),
              min: z.number().finite(),
              max: z.number().finite(),
              step: z.number().positive().finite()
            })
            .strict()
        )
        .min(1)
        .max(6)
    })
    .strict()
]);

export const interactiveResponseSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("sequence"), order: z.array(id).max(8) }).strict(),
  z.object({ type: z.literal("classification"), assignments: z.record(id, id) }).strict(),
  z.object({ type: z.literal("configuration"), values: z.record(id, z.number().finite()) }).strict()
]);

export const interactiveWorkSchema = z
  .object({
    kind: z.literal("interactive"),
    response: interactiveResponseSchema
  })
  .strict();

export type PracticeInteraction = z.infer<typeof practiceInteractionSchema>;
export type InteractiveResponse = z.infer<typeof interactiveResponseSchema>;
export type InteractiveWork = z.infer<typeof interactiveWorkSchema>;

/** A partial order accepts equivalent valid sequences instead of one arbitrary ordering. */
export type InteractionCriterion = {
  label: string;
  points: number;
  explanation: string;
} & (
  | { type: "before"; first: string; second: string }
  | { type: "assignment"; itemId: string; categoryId: string }
  | { type: "range"; fieldId: string; min: number; max: number }
);

export function emptyInteractiveResponse(interaction: PracticeInteraction): InteractiveResponse {
  switch (interaction.type) {
    case "sequence":
      return { type: "sequence", order: [] };
    case "classification":
      return { type: "classification", assignments: {} };
    case "configuration":
      return { type: "configuration", values: {} };
  }
}

/** Used by both the workspace and server. Drafts may be incomplete, never foreign or malformed. */
export function interactiveResponseError(
  interaction: PracticeInteraction,
  response: InteractiveResponse,
  complete: boolean
): string | null {
  if (interaction.type !== response.type) return "Use the answer controls for this question.";
  if (interaction.type === "sequence" && response.type === "sequence") {
    const ids = new Set(interaction.items.map((entry) => entry.id));
    if (
      new Set(response.order).size !== response.order.length ||
      response.order.some((key) => !ids.has(key))
    )
      return "Each step must appear once and belong to this case.";
    if (complete && response.order.length !== ids.size)
      return "Place every step in your response sequence.";
  }
  if (interaction.type === "classification" && response.type === "classification") {
    const ids = new Set(interaction.items.map((entry) => entry.id));
    const categories = new Set(interaction.categories.map((entry) => entry.id));
    if (
      Object.entries(response.assignments).some(
        ([key, value]) => !ids.has(key) || !categories.has(value)
      )
    )
      return "Use only the evidence and categories supplied in this case.";
    if (complete && Object.keys(response.assignments).length !== ids.size)
      return "Classify every evidence card before submitting.";
  }
  if (interaction.type === "configuration" && response.type === "configuration") {
    const fields = new Map(interaction.fields.map((field) => [field.id, field]));
    for (const [key, value] of Object.entries(response.values)) {
      const field = fields.get(key);
      if (!field || !Number.isFinite(value))
        return "Use only the configuration fields supplied in this case.";
      if (value < field.min || value > field.max)
        return `${field.label} must be between ${field.min} and ${field.max}.`;
      const steps = (value - field.min) / field.step;
      if (Math.abs(steps - Math.round(steps)) > 1e-7)
        return `${field.label} must use increments of ${field.step}.`;
    }
    if (complete && Object.keys(response.values).length !== fields.size)
      return "Set every configuration value before submitting.";
  }
  return null;
}

export function scoreInteractiveResponse(
  response: InteractiveResponse,
  criteria: readonly InteractionCriterion[]
) {
  const checks = criteria.map((criterion) => {
    let passed = false;
    if (criterion.type === "before" && response.type === "sequence") {
      const first = response.order.indexOf(criterion.first);
      const second = response.order.indexOf(criterion.second);
      passed = first >= 0 && second >= 0 && first < second;
    } else if (criterion.type === "assignment" && response.type === "classification") {
      passed = response.assignments[criterion.itemId] === criterion.categoryId;
    } else if (criterion.type === "range" && response.type === "configuration") {
      const value = response.values[criterion.fieldId];
      passed = value !== undefined && value >= criterion.min && value <= criterion.max;
    }
    return { ...criterion, passed };
  });
  return {
    score: checks.reduce((sum, check) => sum + (check.passed ? check.points : 0), 0),
    checks
  };
}
