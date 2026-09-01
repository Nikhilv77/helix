import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PREP_DIR = "src/data/prep";

/**
 * Every bank in src/data/prep, not one named file. New banks are validated the
 * moment they are added rather than when someone remembers to widen a test.
 */
export function loadPrepTemplates<T extends { format?: string }>(format: string): T[] {
  return readdirSync(PREP_DIR)
    .filter((file) => file.endsWith(".json"))
    .flatMap((file) => {
      const bank = JSON.parse(readFileSync(join(PREP_DIR, file), "utf8")) as {
        templates?: T[];
      };
      return bank.templates ?? [];
    })
    .filter((template) => template.format === format);
}
