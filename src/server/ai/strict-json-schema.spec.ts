import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { toStrictJsonSchema } from "./strict-json-schema";

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

  it("recurses through arrays of schemas", () => {
    const withArray = z.object({ items: z.array(z.object({ name: z.string().max(5) })) });
    const strict = JSON.stringify(toStrictJsonSchema(convert(withArray, { $refStrategy: "none" })));

    expect(strict).not.toContain("maxLength");
    expect(strict).toContain("additionalProperties");
  });
});
