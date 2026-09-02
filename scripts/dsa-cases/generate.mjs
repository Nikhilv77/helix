/**
 * Expands DSA test cases from reference solutions.
 *
 *   npx tsx scripts/dsa-cases/generate.mjs            report only, writes nothing
 *   npx tsx scripts/dsa-cases/generate.mjs --emit     print the expanded blocks
 *   npx tsx scripts/dsa-cases/generate.mjs --write    rewrite the bank in place
 *
 * The rule this exists to enforce: **nobody hand-writes an expected value.**
 * 200 questions at ten cases each is 2,000 expectations, and a wrong one is
 * worse than a missing one — it fails a correct solution and tells the
 * candidate they cannot code.
 *
 * So every question goes through the same gate:
 *
 *   1. Replay the reference against the existing hand-authored cases.
 *   2. Compare with `equivalent` — the exact comparator the live harness uses,
 *      so a pass here means a pass there.
 *   3. On any disagreement, skip the question and report it. Either the
 *      reference is wrong or the original case was; a human decides which.
 *   4. Only then generate the extra inputs and run the reference for their
 *      expected values.
 *
 * Existing cases are always emitted first and unchanged. `buildTestCases`
 * decides visibility by index, so reordering them would silently turn an
 * example into a hidden case.
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildTestCases,
  equivalent,
  materialiseArguments
} from "../../src/server/dsa/code-test-harness";
import { findQuestion } from "../../src/lib/dsa/dsa";
import { phase1, phase1Rest } from "./references/phase-1-arrays.mjs";
import { phase2 } from "./references/phase-2-strings.mjs";
import { phase3 } from "./references/phase-3-sliding-window.mjs";
import { phase4 } from "./references/phase-4-binary-search.mjs";
import { phase5 } from "./references/phase-5-linked-list.mjs";
import { phase6 } from "./references/phase-6-stack-queue.mjs";
import { phase7 } from "./references/phase-7-trees.mjs";
import { phase8 } from "./references/phase-8-heap.mjs";
import { phase9 } from "./references/phase-9-graphs.mjs";
import { phase10 } from "./references/phase-10-dynamic-programming.mjs";
import { phase11 } from "./references/phase-11-tries-backtracking.mjs";

const REFERENCES = { ...phase1, ...phase1Rest, ...phase2, ...phase3, ...phase4, ...phase5, ...phase6, ...phase7, ...phase8, ...phase9, ...phase10, ...phase11 };

const emit = process.argv.includes("--emit");
const write = process.argv.includes("--write");

/** Deep clone so a mutating reference cannot corrupt the inputs we report. */
const clone = (value) => JSON.parse(JSON.stringify(value));

/**
 * The authored cases only — the ones pinned to the question's examples.
 *
 * buildTestCases returns hidden cases too once they have been written, so
 * filtering on `visible` is what makes this script idempotent: a second run
 * verifies against the same authored set and regenerates the hidden half from
 * scratch instead of appending another copy of it.
 */
function existingCasesFor(slug, question) {
  return buildTestCases(question.examples ?? [], slug).filter((testCase) => testCase.visible);
}

function runReference(reference, args) {
  const input = clone(args);
  const returned = reference.solve(...input);
  // A mutating solution reports the mutated first argument, matching the
  // harness's "mutated-first-argument" mode.
  return reference.mode === "mutated-first-argument" ? input[0] : returned;
}

const results = { verified: [], mismatched: [], missing: [] };

for (const [slug, reference] of Object.entries(REFERENCES)) {
  const question = findQuestion(slug)?.question;
  if (!question) {
    results.missing.push({ slug, reason: "question not found" });
    continue;
  }

  const existing = existingCasesFor(slug, question);
  if (existing.length === 0) {
    results.missing.push({ slug, reason: "no existing cases to verify against" });
    continue;
  }

  // Step 1-3: the reference must reproduce every authored expectation.
  let disagreement = null;
  for (const [index, testCase] of existing.entries()) {
    let actual;
    try {
      actual = runReference(reference, testCase.arguments);
    } catch (error) {
      disagreement = { index, error: error.message };
      break;
    }
    if (!equivalent(actual, testCase.expectedValue, testCase.comparison)) {
      disagreement = {
        index,
        args: testCase.arguments,
        authored: testCase.expectedValue,
        reference: actual
      };
      break;
    }
  }

  if (disagreement) {
    results.mismatched.push({ slug, ...disagreement });
    continue;
  }

  // Step 4: only a verified reference is trusted to produce expectations.
  const generated = [];
  for (const args of reference.generate()) {
    try {
      const solved = runReference(reference, args);
      let expectedValue = solved;
      let comparison = reference.comparison;

      // `accepted` widens an answer for a question where several are correct —
      // "find a peak", not "find the peak". It cannot invent one: the verified
      // reference's own answer has to be in the set it returns, which is what
      // keeps this inside the no-hand-written-expectations rule.
      if (reference.accepted) {
        const options = reference.accepted(...clone(args));
        if (!options.some((option) => equivalent(solved, option, reference.comparison))) {
          results.mismatched.push({
            slug,
            generating: args,
            error: `accepted() omits the reference's own answer ${JSON.stringify(solved)}`
          });
          continue;
        }
        expectedValue = options;
        comparison = "one-of";
      }

      generated.push({
        arguments: clone(args),
        expectedValue: clone(expectedValue),
        ...(reference.mode ? { mode: reference.mode } : {}),
        // Without this an unordered result — 3sum, 4sum — is compared exactly
        // and a correct answer in a different order is marked wrong.
        ...(comparison ? { comparison } : {})
      });
    } catch (error) {
      results.mismatched.push({ slug, generating: args, error: error.message });
    }
  }

  // Step 5: scale cases, whose inputs the generated program builds for itself.
  //
  // These exist to make wrong complexity fail. An inlined input is capped near
  // 2,000 elements by Java's 64KB method limit, and at that size a quadratic
  // solution finishes instantly — so a built input is the only way the time
  // limit means anything. The expected value still comes from replaying the
  // verified reference over the same array.
  for (const scaleCase of reference.scale?.() ?? []) {
    const args = materialiseArguments(scaleCase);
    try {
      const expectedValue = runReference(reference, args);
      if (Array.isArray(expectedValue) && expectedValue.length > 64) {
        results.mismatched.push({
          slug,
          generating: scaleCase.build,
          error: `scale case answers with ${expectedValue.length} values; the answer is written into the bank, so scale cases must answer small`
        });
        continue;
      }
      generated.push({
        arguments: clone(scaleCase.arguments),
        expectedValue: clone(expectedValue),
        build: clone(scaleCase.build),
        ...(reference.mode ? { mode: reference.mode } : {}),
        ...(reference.comparison ? { comparison: reference.comparison } : {})
      });
    } catch (error) {
      results.mismatched.push({ slug, generating: scaleCase.build, error: error.message });
    }
  }

  results.verified.push({
    slug,
    existingCases: existing,
    existing: existing.length,
    added: generated.length,
    total: existing.length + generated.length,
    generated
  });
}

/**
 * Rewrites a slug's case array in whichever batch file declares it.
 *
 * Existing cases are re-emitted verbatim and first: `buildTestCases` decides
 * visibility by index, so reordering them would silently turn an authored
 * example into a hidden case.
 */
function writeCases(slug, existing, generated) {
  const dir = "src/data/dsa";
  for (const file of readdirSync(dir).filter((name) => name.startsWith("test-cases-batch"))) {
    const path = join(dir, file);
    const source = readFileSync(path, "utf8");
    const key = `  "${slug}": [`;
    const start = source.indexOf(key);
    if (start === -1) continue;

    // Brackets inside a string literal are not structure. `valid-parentheses`
    // has "]" as an input, which closed the array early and truncated the file.
    let depth = 1;
    let i = start + key.length;
    let quote = "";
    while (i < source.length && depth > 0) {
      const character = source[i];
      if (quote) {
        if (character === "\\") i++;
        else if (character === quote) quote = "";
      } else if (character === '"' || character === "'") quote = character;
      else if (character === "[") depth++;
      else if (character === "]") depth--;
      i++;
    }

    const serialise = (testCase) => {
      const parts = [
        `arguments: ${JSON.stringify(testCase.arguments)}`,
        `expectedValue: ${JSON.stringify(testCase.expectedValue)}`
      ];
      if (testCase.mode) parts.push(`mode: ${JSON.stringify(testCase.mode)}`);
      if (testCase.comparison) parts.push(`comparison: ${JSON.stringify(testCase.comparison)}`);
      if (testCase.build) parts.push(`build: ${JSON.stringify(testCase.build)}`);
      return `    { ${parts.join(", ")} }`;
    };

    const visible = existing.map((testCase) => serialise({
      arguments: testCase.arguments,
      expectedValue: testCase.expectedValue,
      mode: testCase.mode,
      comparison: testCase.comparison,
      build: testCase.build
    }));
    const hidden = generated.map(serialise);
    const comment = "    // Hidden from here on — generated from the verified reference.";
    const body =
      visible.join(",\n") +
      (hidden.length ? `,\n${comment}\n${hidden.join(",\n")}` : "");

    const next = `${source.slice(0, start)}${key}\n${body}\n  ]${source.slice(i)}`;
    writeFileSync(path, next);
    return file;
  }
  return null;
}

const pad = (value, width) => String(value).padStart(width);

console.log("\nVerified against authored cases, then expanded");
for (const row of results.verified) {
  console.log(
    `  ${row.slug.padEnd(36)} ${pad(row.existing, 2)} -> ${pad(row.total, 2)}  (+${row.added} hidden)`
  );
}

if (results.mismatched.length) {
  console.log("\nSKIPPED — reference disagrees with an authored case");
  for (const row of results.mismatched) {
    console.log(`  ${row.slug}`);
    if (row.error) console.log(`     error: ${row.error}`);
    else {
      console.log(`     args:      ${JSON.stringify(row.args)}`);
      console.log(`     authored:  ${JSON.stringify(row.authored)}`);
      console.log(`     reference: ${JSON.stringify(row.reference)}`);
    }
  }
  console.log("\n  One of the two is wrong. Nothing was emitted for these.");
}

if (results.missing.length) {
  console.log("\nNo reference applied");
  for (const row of results.missing) console.log(`  ${row.slug}: ${row.reason}`);
}

const totalBefore = results.verified.reduce((sum, row) => sum + row.existing, 0);
const totalAfter = results.verified.reduce((sum, row) => sum + row.total, 0);
console.log(
  `\n${results.verified.length} questions verified — ${totalBefore} cases becoming ${totalAfter}` +
    `${results.mismatched.length ? `, ${results.mismatched.length} skipped` : ""}\n`
);

if (write) {
  console.log("Writing to the bank");
  for (const row of results.verified) {
    const file = writeCases(row.slug, row.existingCases, row.generated);
    console.log(`  ${file ? "ok  " : "MISS"}  ${row.slug.padEnd(36)} ${file ?? "slug not found in any batch"}`);
  }
  console.log("\nRe-run without --write to verify the new totals.\n");
}

if (emit) {
  console.log("// Append these to the question's existing array, after the authored cases.\n");
  for (const row of results.verified) {
    console.log(`  // ${row.slug} — ${row.added} hidden cases`);
    for (const testCase of row.generated) {
      console.log(`  ${JSON.stringify(testCase)},`);
    }
    console.log("");
  }
}

process.exitCode = results.mismatched.length ? 1 : 0;
