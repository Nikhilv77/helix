import { isRecord } from "../common/utils/is-record";

/**
 * Constrained decoding accepts a narrower JSON Schema than Zod emits.
 *
 * Length and numeric bounds are dropped here because the decoder rejects them;
 * they are still enforced, just by the Zod parse on the way back rather than by
 * the model. Every object is forced closed with all keys required, which is
 * what strict mode demands.
 */
const UNSUPPORTED_KEYWORDS = new Set([
  "$schema",
  "$id",
  "default",
  "minLength",
  "maxLength",
  "pattern",
  "format",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minItems",
  "maxItems",
  "uniqueItems"
]);

export function toStrictJsonSchema(schema: unknown): unknown {
  return transformSchema(schema, false, true);
}

/**
 * Prunes unsupported validation keywords without changing which properties
 * are optional. Gemini accepts this form and does not require OpenAI-style
 * strict schemas where every property is listed in `required`.
 */
export function toPrunedJsonSchema(schema: unknown): unknown {
  return transformSchema(schema, false, false);
}

function transformSchema(
  schema: unknown,
  isPropertyMap: boolean,
  requireEveryProperty: boolean
): unknown {
  if (Array.isArray(schema)) {
    return schema.map((item) => transformSchema(item, false, requireEveryProperty));
  }

  if (!isRecord(schema)) {
    return schema;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(schema)) {
    if (!isPropertyMap && UNSUPPORTED_KEYWORDS.has(key)) continue;
    if (!isPropertyMap && key === "const") {
      result.enum = [transformSchema(value, false, requireEveryProperty)];
      continue;
    }
    result[key] = transformSchema(
      value,
      !isPropertyMap && key === "properties",
      requireEveryProperty
    );
  }

  if (result.type === "object") {
    result.additionalProperties = false;

    if (requireEveryProperty) {
      const properties = isRecord(result.properties) ? result.properties : {};
      // Strict mode has no notion of optional keys: everything must be required.
      result.required = Object.keys(properties);
    }
  }

  return result;
}
