import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { toPrunedJsonSchema, toStrictJsonSchema } from "./strict-json-schema";

const convert = zodToJsonSchema as (schema: unknown, options: { $refStrategy: "none" }) => unknown;

describe("toStrictJsonSchema", () => {
  const decisionSchema = z.object({
    action: z.enum(["probe", "challenge", "move_on"]),
    missing: z.enum(["structure", "specificity", "ownership", "outcome", "none"]),
    reason: z.string().min(1).max(200),
    line: z.string().max(240)
  });

  it("strips keywords constrained decoding rejects", () => {
    const strict = toStrictJsonSchema(convert(decisionSchema, { $refStrategy: "none" })) as Record<
      string,
      never
    >;

    expect(strict).not.toHaveProperty("$schema");

    const serialised = JSON.stringify(strict);
    expect(serialised).not.toContain("minLength");
    expect(serialised).not.toContain("maxLength");
  });

  it("keeps enums, which the decoder needs to constrain the action", () => {
    const strict = JSON.stringify(
      toStrictJsonSchema(convert(decisionSchema, { $refStrategy: "none" }))
    );

    expect(strict).toContain("probe");
    expect(strict).toContain("challenge");
    expect(strict).toContain("move_on");
  });

  it("converts literals to one-value enums for strict decoder compatibility", () => {
    const withLiteral = z.object({ schemaVersion: z.literal(1) });
    const strict = toStrictJsonSchema(convert(withLiteral, { $refStrategy: "none" })) as {
      properties: { schemaVersion: { enum: number[]; const?: number } };
    };

    expect(strict.properties.schemaVersion.enum).toEqual([1]);
    expect(strict.properties.schemaVersion).not.toHaveProperty("const");
  });

  it("preserves application properties whose names match schema keywords", () => {
    const collidingNames = z.object({
      format: z.string().min(2),
      default: z.string().max(20),
      minimum: z.number().min(1)
    });
    const strict = toStrictJsonSchema(convert(collidingNames, { $refStrategy: "none" })) as {
      properties: Record<string, Record<string, unknown>>;
      required: string[];
    };

    expect(Object.keys(strict.properties).sort()).toEqual(["default", "format", "minimum"]);
    expect(strict.required.sort()).toEqual(["default", "format", "minimum"]);
    expect(strict.properties.format).not.toHaveProperty("minLength");
    expect(strict.properties.minimum).not.toHaveProperty("minimum");
  });

  it("closes every object and requires every key", () => {
    const nested = z.object({
      outer: z.string(),
      inner: z.object({ a: z.string(), b: z.string().optional() })
    });

    const strict = toStrictJsonSchema(convert(nested, { $refStrategy: "none" })) as {
      additionalProperties: boolean;
      required: string[];
      properties: { inner: { additionalProperties: boolean; required: string[] } };
    };

    expect(strict.additionalProperties).toBe(false);
    expect(strict.required.sort()).toEqual(["inner", "outer"]);
    // Optional keys are not a concept in strict mode.
    expect(strict.properties.inner.additionalProperties).toBe(false);
    expect(strict.properties.inner.required.sort()).toEqual(["a", "b"]);
  });

  it("preserves optional properties in the pruned non-strict form", () => {
    const schema = z.object({ requiredValue: z.string(), optionalValue: z.string().optional() });
    const pruned = toPrunedJsonSchema(convert(schema, { $refStrategy: "none" })) as {
      additionalProperties: boolean;
      required: string[];
      properties: Record<string, unknown>;
    };

    expect(pruned.additionalProperties).toBe(false);
    expect(pruned.required).toEqual(["requiredValue"]);
    expect(Object.keys(pruned.properties).sort()).toEqual(["optionalValue", "requiredValue"]);
  });

  it("recurses through arrays of schemas", () => {
    const withArray = z.object({ items: z.array(z.object({ name: z.string().max(5) })) });
    const strict = JSON.stringify(toStrictJsonSchema(convert(withArray, { $refStrategy: "none" })));

    expect(strict).not.toContain("maxLength");
    expect(strict).toContain("additionalProperties");
  });
});
