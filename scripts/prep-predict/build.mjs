/**
 * Builds the `predict-run` banks for Python, Java and C++.
 *
 *   node scripts/prep-predict/build.mjs           verify the committed banks
 *   node scripts/prep-predict/build.mjs --write   rebuild them
 *
 * The rule, same as the DSA case generator: **nobody writes an expected output
 * by hand.** Each snippet in `snippets/` is compiled and run, and whatever it
 * prints becomes `answerKey.expectedStdout`. The default mode re-runs
 * everything and fails if a committed bank has drifted from what the code
 * actually prints — so a snippet edited without a rebuild is caught rather than
 * silently grading candidates against a stale answer.
 *
 * Requires `python3`, `javac`/`java` and a C++17 compiler. C++ snippets include
 * <bits/stdc++.h> nowhere on purpose: that is a GCC extension, and these have to
 * build under clang too.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CPP, JAVA, PYTHON } from "./manifest.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SNIPPETS = join(HERE, "snippets");
const OUT = join(HERE, "..", "..", "src", "data", "prep");
const write = process.argv.includes("--write");

const LANGUAGES = {
  py: {
    language: "python",
    bank: "python-runtime-predict",
    file: "python-runtime-predict.json",
    dir: "python",
    sourceLinks: [
      {
        id: "python-datamodel",
        title: "Python Language Reference — Data model",
        url: "https://docs.python.org/3/reference/datamodel.html",
        notes: "Objects, identity, and attribute lookup."
      }
    ],
    run: (source, directory) => {
      const file = join(directory, "snippet.py");
      writeFileSync(file, source);
      return execFileSync("python3", [file], { encoding: "utf8" });
    }
  },
  java: {
    language: "java",
    bank: "java-runtime-predict",
    file: "java-runtime-predict.json",
    dir: "java",
    sourceLinks: [
      {
        id: "jls",
        title: "The Java Language Specification",
        url: "https://docs.oracle.com/javase/specs/jls/se21/html/index.html",
        notes: "Conversions, initialization order, and method selection."
      }
    ],
    run: (source, directory) => {
      // The public class name has to match the file name.
      const name = source.match(/public\s+class\s+(\w+)/)?.[1];
      if (!name) throw new Error("no public class found");
      const file = join(directory, `${name}.java`);
      writeFileSync(file, source);
      execFileSync("javac", [file], { cwd: directory, encoding: "utf8" });
      return execFileSync("java", ["-cp", directory, name], { encoding: "utf8" });
    }
  },
  cpp: {
    language: "cpp",
    bank: "cpp-runtime-predict",
    file: "cpp-runtime-predict.json",
    dir: "cpp",
    sourceLinks: [
      {
        id: "cppreference",
        title: "cppreference — Language",
        url: "https://en.cppreference.com/w/cpp/language",
        notes: "Conversions, lifetime, and virtual dispatch."
      }
    ],
    run: (source, directory) => {
      const file = join(directory, "snippet.cpp");
      const binary = join(directory, "snippet");
      writeFileSync(file, source);
      execFileSync("g++", ["-std=c++17", "-o", binary, file], { encoding: "utf8" });
      return execFileSync(binary, [], { encoding: "utf8" });
    }
  }
};

/** Trailing whitespace is not part of the answer; the grader trims it too. */
const normalise = (value) =>
  value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n+$/, "");

function buildBank(key, questions) {
  const config = LANGUAGES[key];
  const directory = mkdtempSync(join(tmpdir(), `trailgrad-predict-${key}-`));
  try {
    const templates = questions.map((question) => {
      const source = readFileSync(join(SNIPPETS, config.dir, question.file), "utf8");
      const expectedStdout = normalise(config.run(source, directory));
      if (!expectedStdout) throw new Error(`${question.file} printed nothing`);
      // `language` and `file` are build inputs, not part of the published bank.
      const rest = { ...question };
      delete rest.language;
      delete rest.file;
      return {
        ...rest,
        answerKey: {
          code: normalise(source),
          language: config.language,
          expectedStdout
        },
        sourceLinkIds: [config.sourceLinks[0].id]
      };
    });
    return { bank: config.bank, sourceLinks: config.sourceLinks, templates };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

let drift = 0;
for (const [key, questions] of Object.entries({ py: PYTHON, java: JAVA, cpp: CPP })) {
  const config = LANGUAGES[key];
  const built = buildBank(key, questions);
  const path = join(OUT, config.file);
  const serialised = `${JSON.stringify(built, null, 2)}\n`;

  if (write) {
    writeFileSync(path, serialised);
    console.log(`  wrote ${config.file}  ${built.templates.length} questions`);
    continue;
  }

  let existing = null;
  try {
    existing = readFileSync(path, "utf8");
  } catch {
    console.log(`  MISSING  ${config.file} — run with --write`);
    drift++;
    continue;
  }
  if (existing === serialised) {
    console.log(`  ok       ${config.file}  ${built.templates.length} questions match execution`);
  } else {
    console.log(`  DRIFTED  ${config.file} — the committed bank is not what the code prints`);
    const committed = JSON.parse(existing).templates ?? [];
    for (const template of built.templates) {
      const match = committed.find((item) => item.id === template.id);
      if (!match) {
        console.log(`     ${template.id}: not in the committed bank`);
        continue;
      }
      if (match.answerKey?.expectedStdout !== template.answerKey.expectedStdout) {
        console.log(`     ${template.id}: expected output differs`);
        console.log(`       committed: ${JSON.stringify(match.answerKey?.expectedStdout)}`);
        console.log(`       actual:    ${JSON.stringify(template.answerKey.expectedStdout)}`);
      }
    }
    drift++;
  }
}

if (!write && drift === 0) console.log("\nEvery expected output matches a real run.\n");
process.exitCode = drift ? 1 : 0;
