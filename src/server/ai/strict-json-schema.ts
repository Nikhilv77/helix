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
  if (Array.isArray(schema)) {
    return schema.map(toStrictJsonSchema);
  }

  if (!isRecord(schema)) {
    return schema;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(schema)) {
    if (UNSUPPORTED_KEYWORDS.has(key)) continue;
    result[key] = toStrictJsonSchema(value);
  }

  if (result.type === "object") {
    result.additionalProperties = false;

    const properties = isRecord(result.properties) ? result.properties : {};
    // Strict mode has no notion of optional keys: everything must be required.
    result.required = Object.keys(properties);
  }

  return result;
}
