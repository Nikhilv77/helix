/**
 * Expands DSA test cases from reference solutions.
 *
 *   npx tsx scripts/dsa-cases/generate.mjs            report only, writes nothing
 *   npx tsx scripts/dsa-cases/generate.mjs --emit     print the expanded blocks
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

import { buildTestCases, equivalent } from "../../src/server/dsa/code-test-harness";
import { findQuestion } from "../../src/lib/dsa/dsa";
import { phase1 } from "./references/phase-1-arrays.mjs";

const REFERENCES = { ...phase1 };

const emit = process.argv.includes("--emit");

/** Deep clone so a mutating reference cannot corrupt the inputs we report. */
const clone = (value) => JSON.parse(JSON.stringify(value));

// buildTestCases is the only public path to the structured cases, and it
// already resolves the batch chain.
function existingCasesFor(slug, question) {
  return buildTestCases(question.examples ?? [], slug);
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
      const expectedValue = runReference(reference, args);
      generated.push({
        arguments: clone(args),
        expectedValue: clone(expectedValue),
        ...(reference.mode ? { mode: reference.mode } : {})
      });
    } catch (error) {
      results.mismatched.push({ slug, generating: args, error: error.message });
    }
  }

  results.verified.push({
    slug,
    existing: existing.length,
    added: generated.length,
    total: existing.length + generated.length,
    generated
  });
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
