import type { DsaExample } from "@/lib/dsa/dsa";
import { structuredCasesFor } from "../../data/dsa/test-cases-batch-1";

export type CodeRunnerLanguage = "python" | "javascript" | "cpp" | "java";

export interface CodeTestCase {
  input: string;
  expectedOutput: string;
  /**
   * Whether the candidate is shown this case's input and expected output.
   *
   * Authored `examples` are visible by construction — they appear in the problem
   * statement. Cases beyond them are hidden, which is the point: a solution that
   * special-cases the inputs it can see should not pass.
   */
  visible: boolean;
  arguments: unknown[];
  expectedValue: unknown;
  mode?: "return" | "mutated-first-argument";
  comparison?: "exact" | "unordered" | "unordered-nested" | "unordered-deep" | "one-of";
  adapter?: TestAdapter;
  /**
   * Arguments the generated program builds for itself, one entry per argument,
   * `null` to keep the literal.
   *
   * Inlining an input costs Java roughly one bytecode instruction per element
   * against a 64KB method cap, which is why every case was capped near 2,000
   * elements — and at 2,000 a quadratic solution finishes in milliseconds, so
   * wrong complexity passed everywhere. Built inputs have no literal, so a case
   * can be large enough for the time limit to mean something.
   */
  build?: Array<BuiltArgument | null>;
}

/**
 * How to build one argument. `arguments` still carries a small value of the same
 * shape, which is what the Java and C++ type inference reads.
 */
export type BuiltArgument =
  | { ints: { n: number; lo: number; hi: number; seed: number } }
  | { sequence: { n: number; start: number; step: number } };

type TestAdapter =
  | "linked-list"
  | "linked-list-mutated"
  | "linked-list-cycle"
  | "linked-list-cycle-entry"
  | "linked-list-intersection"
  | "linked-list-random"
  | "graph-clone"
  | "tree-input"
  | "tree-output"
  | "tree-result"
  | "tree-mutated-output"
  | "tree-right-chain"
  | "tree-node-value"
  | "tree-target-value"
  | `operations:${string}`;

export interface CodeTestResult {
  index: number;
  /** False for a case beyond the authored examples; detail is withheld. */
  visible: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  error: string | null;
}

const RESULT_MARKER = "__TRAILGRAD_CASE__";

/**
 * Cases beyond the authored examples are hidden and still graded.
 *
 * This used to map over `examples`, which made the test set and the example set
 * the same thing: no question could have more cases than it printed in its
 * problem statement, and every input a solution had to satisfy was visible to
 * the person writing it. Structured cases now drive the run, and examples
 * supply the display strings for the ones a candidate can see.
 */
const MAX_TEST_CASES = 40;

export function buildTestCases(examples: DsaExample[], slug?: string): CodeTestCase[] {
  const structured = slug ? structuredCasesFor(slug, examples) : null;
  const adapter = slug ? adapterForSlug(slug) : undefined;

  // Without structured cases there is nothing to run but the examples, exactly
  // as before.
  if (!structured?.length) {
    return examples.slice(0, MAX_TEST_CASES).map((example) => ({
      input: example.input,
      expectedOutput: example.output,
      visible: true,
      arguments: parseArguments(example.input),
      expectedValue: parseValue(example.output),
      adapter
    }));
  }

  return structured.slice(0, MAX_TEST_CASES).map((structuredCase, index) => {
    const example = examples[index];
    const visible = example !== undefined;
    return {
      // Hidden cases carry no display strings — nothing should be able to print
      // them back to the candidate by accident.
      input: visible ? example.input : "",
      expectedOutput: visible ? example.output : "",
      visible,
      arguments: structuredCase.arguments,
      expectedValue: structuredCase.expectedValue,
      mode: structuredCase.mode,
      comparison: structuredCase.comparison,
      build: structuredCase.build,
      adapter
    };
  });
}

/**
 * MINSTD, chosen because it is exact in every language the harness targets.
 *
 * The intermediate product stays under 2^53, so a JavaScript double holds it
 * without loss, and Java `long`, C++ `long long` and Python integers all agree
 * exactly. The generator the reference scripts previously used multiplied by
 * 1103515245, which reaches 2.3e18 — past 2^53 — so JavaScript had already
 * diverged from exact integer arithmetic and could never have matched Java.
 */
const MINSTD_MULTIPLIER = 48271;
const MINSTD_MODULUS = 2147483647;

export function builtInts(n: number, lo: number, hi: number, seed: number): number[] {
  const range = hi - lo + 1;
  let state = seed;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    state = (state * MINSTD_MULTIPLIER) % MINSTD_MODULUS;
    out.push(lo + (state % range));
  }
  return out;
}

export function builtSequence(n: number, start: number, step: number): number[] {
  return Array.from({ length: n }, (_, i) => start + i * step);
}

function materialiseArgument(spec: BuiltArgument): number[] {
  if ("ints" in spec) return builtInts(spec.ints.n, spec.ints.lo, spec.ints.hi, spec.ints.seed);
  return builtSequence(spec.sequence.n, spec.sequence.start, spec.sequence.step);
}

/** The arguments a case really runs on, with any built ones expanded. */
export function materialiseArguments(testCase: {
  arguments: unknown[];
  build?: Array<BuiltArgument | null>;
}): unknown[] {
  if (!testCase.build) return testCase.arguments;
  return testCase.arguments.map((value, index) => {
    const spec = testCase.build?.[index];
    return spec ? materialiseArgument(spec) : value;
  });
}

export function buildTestHarness(
  code: string,
  language: CodeRunnerLanguage,
  functionName: string,
  testCases: CodeTestCase[]
): string {
  if (testCases[0]?.adapter?.startsWith("operations:")) {
    if (language === "javascript") return javascriptOperationHarness(code, testCases);
    if (language === "python") return pythonOperationHarness(code, testCases);
    if (language === "java") return javaOperationHarness(code, testCases);
    return cppOperationHarness(code, testCases);
  }
  if (language === "javascript") return javascriptHarness(code, functionName, testCases);
  if (language === "python") return pythonHarness(code, functionName, testCases);
  if (language === "java") return javaHarness(code, functionName, testCases);
  return cppHarness(code, functionName, testCases);
}

export function parseTestResults(stdout: string, testCases: CodeTestCase[]): CodeTestResult[] {
  const payloads = new Map<number, { ok?: boolean; value?: unknown; error?: string }>();
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.startsWith(RESULT_MARKER)) continue;
    const separator = line.indexOf(":", RESULT_MARKER.length);
    if (separator === -1) continue;
    const index = Number(line.slice(RESULT_MARKER.length, separator));
    try {
      payloads.set(
        index,
        JSON.parse(line.slice(separator + 1)) as { ok?: boolean; value?: unknown; error?: string }
      );
    } catch {
      payloads.set(index, { ok: false, error: "The test runner returned invalid output." });
    }
  }

  return testCases.map((testCase, index) => {
    const payload = payloads.get(index);
    const error = payload?.ok === false ? payload.error || "Runtime error" : null;
    const actual = payload?.value;
    const passed =
      Boolean(payload?.ok) && equivalent(actual, testCase.expectedValue, testCase.comparison);

    // A hidden case reports only whether it passed. Returning its input,
    // expected value or the produced output would hand back the very thing the
    // case exists to withhold — including through the runtime error string.
    if (!testCase.visible) {
      return {
        index,
        visible: false,
        input: "",
        expectedOutput: "",
        actualOutput: "",
        passed,
        error: payload ? (error ? "Runtime error" : null) : "No result was returned."
      };
    }

    return {
      index,
      visible: true,
      input: testCase.input,
      expectedOutput: testCase.expectedOutput,
      actualOutput: error ? "" : displayValue(actual),
      passed,
      error: payload ? error : "No result was returned for this test case."
    };
  });
}

export function resultMarker(): string {
  return RESULT_MARKER;
}

function parseArguments(input: string): unknown[] {
  return splitTopLevel(input).map((part) => {
    const assignment = part.indexOf("=");
    return parseValue(assignment === -1 ? part : part.slice(assignment + 1));
  });
}

function parseValue(value: string): unknown {
  const trimmed = value.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    if (trimmed === "True") return true;
    if (trimmed === "False") return false;
    if (trimmed === "None") return null;
    throw new Error(`Unsupported test value: ${trimmed}`);
  }
}

function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index] ?? "";
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === "[" || character === "{" || character === "(") depth += 1;
    else if (character === "]" || character === "}" || character === ")") depth -= 1;
    else if (character === "," && depth === 0) {
      parts.push(input.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(input.slice(start).trim());
  return parts.filter(Boolean);
}

/** The call that builds one argument, in each language's own syntax. */
function builtArgumentCall(spec: BuiltArgument, language: CodeRunnerLanguage): string {
  const name = "ints" in spec ? "trailgradBuiltInts" : "trailgradBuiltSequence";
  const snake = "ints" in spec ? "trailgrad_built_ints" : "trailgrad_built_sequence";
  const args =
    "ints" in spec
      ? [spec.ints.n, spec.ints.lo, spec.ints.hi, spec.ints.seed]
      : [spec.sequence.n, spec.sequence.start, spec.sequence.step];
  const call = language === "python" ? snake : name;
  return `${call}(${args.join(", ")})`;
}

/**
 * The literal for one argument, or the call that builds it.
 *
 * A built argument never appears in the source, which is the whole point: the
 * program can then work on hundreds of thousands of elements without a literal
 * Java cannot compile.
 */
function argumentSource(
  testCase: CodeTestCase,
  index: number,
  language: CodeRunnerLanguage,
  literal: string
): string {
  const spec = testCase.build?.[index];
  return spec ? builtArgumentCall(spec, language) : literal;
}

function javascriptHarness(code: string, functionName: string, testCases: CodeTestCase[]): string {
  const runs = testCases
    .map(
      (testCase, index) => `try {
  const rawArguments = [${testCase.arguments.map((value, index) => argumentSource(testCase, index, "javascript", jsLiteral(value))).join(", ")}];
  const argumentsList = trailgradAdaptArguments(rawArguments, "${testCase.adapter ?? "none"}");
  const value = ${functionName}(...argumentsList);
  const outputValue = ${testCase.mode === "mutated-first-argument" ? "argumentsList[0]" : "value"};
  const output = trailgradAdaptOutput(outputValue === undefined && ["linked-list-mutated", "tree-output", "tree-mutated-output", "tree-right-chain"].includes("${testCase.adapter ?? "none"}") ? argumentsList[0] : outputValue, "${testCase.adapter ?? "none"}", argumentsList);
  console.log("${RESULT_MARKER}${index}:" + JSON.stringify({ ok: true, value: output }));
} catch (error) {
  console.log("${RESULT_MARKER}${index}:" + JSON.stringify({ ok: false, error: String(error && error.message || error) }));
}`
    )
    .join("\n");
  return `${javascriptAdapterHelpers()}\n${code}\n\n${runs}\n`;
}

function pythonHarness(code: string, functionName: string, testCases: CodeTestCase[]): string {
  const runs = testCases
    .map(
      (testCase, index) => `try:
    raw_arguments = [${testCase.arguments.map((value, index) => argumentSource(testCase, index, "python", pythonLiteral(value))).join(", ")}]
    arguments_list = trailgrad_adapt_arguments(raw_arguments, "${testCase.adapter ?? "none"}")
    value = ${functionName}(*arguments_list)
    output_value = ${testCase.mode === "mutated-first-argument" ? "arguments_list[0]" : "value"}
    output = trailgrad_adapt_output(arguments_list[0] if output_value is None and "${testCase.adapter ?? "none"}" in ("linked-list-mutated", "tree-output", "tree-mutated-output", "tree-right-chain") else output_value, "${testCase.adapter ?? "none"}", arguments_list)
    print("${RESULT_MARKER}${index}:" + json.dumps({"ok": True, "value": output}, separators=(",", ":")))
except Exception as error:
    print("${RESULT_MARKER}${index}:" + json.dumps({"ok": False, "error": str(error)}, separators=(",", ":")))`
    )
    .join("\n");
  return `import json\n${pythonAdapterHelpers()}\n${code}\n\n${runs}\n`;
}

/**
 * Operations that return nothing, per class-operation question.
 *
 * This is the one thing a statically-typed runner needs that the JavaScript one
 * gets for free: `results.push(instance.pop())` works there whatever `pop`
 * returns, but Java and C++ have to know whether there is a value to take. It
 * mirrors `trailgradOperationValue`, which reports null for exactly these.
 *
 * `min-stack` lists `pop` because LeetCode's MinStack.pop returns void, while
 * the queue and stack questions specify a pop that returns what it removed.
 */
const VOID_OPERATIONS: Record<string, string[]> = {
  "min-stack": ["push", "pop"],
  "lru-cache": ["put"],
  queue: ["push"],
  stack: ["push"],
  trie: ["insert"],
  "word-dictionary": ["addWord"],
  "time-map": ["set"],
  "circular-queue": [],
  "stock-span": [],
  "median-finder": ["addNum"],
  "browser-history": ["visit"]
};

const returnsNothing = (kind: string, operation: string): boolean =>
  (VOID_OPERATIONS[kind] ?? []).includes(operation);

function operationKind(adapter: TestAdapter | undefined): string {
  return adapter?.startsWith("operations:") ? adapter.slice("operations:".length) : "";
}

function operationClassName(kind: string): string {
  return (
    {
      "browser-history": "BrowserHistory",
      "lru-cache": "LRUCache",
      "min-stack": "MinStack",
      queue: "MyQueue",
      stack: "MyStack",
      "circular-queue": "MyCircularQueue",
      "stock-span": "StockSpanner",
      "time-map": "TimeMap",
      "median-finder": "MedianFinder",
      trie: "Trie",
      "word-dictionary": "WordDictionary"
    }[kind] ?? "Solution"
  );
}

function javascriptOperationHarness(code: string, testCases: CodeTestCase[]): string {
  const runs = testCases
    .map((testCase, index) =>
      javascriptOperationCase(operationKind(testCase.adapter), testCase.arguments, index)
    )
    .join("\n");
  return `${code}\n\nfunction trailgradOperationValue(kind, operation, value) { if ((kind === "min-stack" && ["push", "pop"].includes(operation)) || (kind === "lru-cache" && operation === "put") || (["trie", "word-dictionary"].includes(kind) && ["insert", "addWord"].includes(operation)) || (kind === "time-map" && operation === "set")) return null; return value === undefined ? null : value; }\n\n${runs}\n`;
}

function javascriptOperationCase(kind: string, args: unknown[], index: number): string {
  const className = operationClassName(kind);
  const literal = JSON.stringify(args);
  if (kind === "browser-history")
    return `try { const input = ${literal}; const instance = new ${className}(input[0][0]); const results = [null]; for (const page of input[0].slice(1)) { instance.visit(page); results.push(null); } for (const operation of input.slice(1)) results.push(trailgradOperationValue("${kind}", operation[0], instance[operation[0]](...operation.slice(1)))); console.log("${RESULT_MARKER}${index}:" + JSON.stringify({ ok: true, value: results })); } catch (error) { console.log("${RESULT_MARKER}${index}:" + JSON.stringify({ ok: false, error: String(error && error.message || error) })); }`;
  if (kind === "lru-cache" || kind === "circular-queue")
    return `try { const input = ${literal}; const instance = new ${className}(...input[0]); const results = []; for (const operation of input.slice(1)) results.push(trailgradOperationValue("${kind}", operation[0], instance[operation[0]](...operation.slice(1)))); console.log("${RESULT_MARKER}${index}:" + JSON.stringify({ ok: true, value: results })); } catch (error) { console.log("${RESULT_MARKER}${index}:" + JSON.stringify({ ok: false, error: String(error && error.message || error) })); }`;
  if (kind === "stock-span" || kind === "median-finder")
    return `try { const input = ${literal}; const instance = new ${className}(); const results = []; for (const value of input[0]) ${kind === "stock-span" ? "results.push(instance.next(value))" : "instance.addNum(value)"}; ${kind === "median-finder" ? "results.push(instance.findMedian());" : ""} console.log("${RESULT_MARKER}${index}:" + JSON.stringify({ ok: true, value: results.length === 1 && "${kind}" === "median-finder" ? results[0] : results })); } catch (error) { console.log("${RESULT_MARKER}${index}:" + JSON.stringify({ ok: false, error: String(error && error.message || error) })); }`;
  return `try { const input = ${literal}; const instance = new ${className}(); const results = []; for (const operation of input) results.push(trailgradOperationValue("${kind}", operation[0], instance[operation[0]](...operation.slice(1)))); console.log("${RESULT_MARKER}${index}:" + JSON.stringify({ ok: true, value: results })); } catch (error) { console.log("${RESULT_MARKER}${index}:" + JSON.stringify({ ok: false, error: String(error && error.message || error) })); }`;
}

function pythonOperationHarness(code: string, testCases: CodeTestCase[]): string {
  const runs = testCases
    .map((testCase, index) =>
      pythonOperationCase(operationKind(testCase.adapter), testCase.arguments, index)
    )
    .join("\n");
  return `import json\n${code}\n\ndef trailgrad_operation_value(kind, operation, value):\n    if (kind == "min-stack" and operation in ("push", "pop")) or (kind == "lru-cache" and operation == "put") or (kind in ("trie", "word-dictionary") and operation in ("insert", "addWord")) or (kind == "time-map" and operation == "set"): return None\n    return value\n\n${runs}\n`;
}

function pythonOperationCase(kind: string, args: unknown[], index: number): string {
  const className = operationClassName(kind);
  const literal = pythonLiteral(args);
  if (kind === "browser-history")
    return `try:\n    input_data = ${literal}\n    instance = ${className}(input_data[0][0])\n    results = [None]\n    for page in input_data[0][1:]: instance.visit(page); results.append(None)\n    for operation in input_data[1:]: results.append(trailgrad_operation_value("${kind}", operation[0], getattr(instance, operation[0])(*operation[1:])))\n    print("${RESULT_MARKER}${index}:" + json.dumps({"ok": True, "value": results}, separators=(",", ":")))\nexcept Exception as error:\n    print("${RESULT_MARKER}${index}:" + json.dumps({"ok": False, "error": str(error)}, separators=(",", ":")))`;
  if (kind === "lru-cache" || kind === "circular-queue")
    return `try:\n    input_data = ${literal}\n    instance = ${className}(*input_data[0])\n    results = [trailgrad_operation_value("${kind}", operation[0], getattr(instance, operation[0])(*operation[1:])) for operation in input_data[1:]]\n    print("${RESULT_MARKER}${index}:" + json.dumps({"ok": True, "value": results}, separators=(",", ":")))\nexcept Exception as error:\n    print("${RESULT_MARKER}${index}:" + json.dumps({"ok": False, "error": str(error)}, separators=(",", ":")))`;
  if (kind === "stock-span" || kind === "median-finder")
    return `try:\n    input_data = ${literal}\n    instance = ${className}()\n    results = [instance.next(value) for value in input_data[0]] if "${kind}" == "stock-span" else [instance.addNum(value) for value in input_data[0]]\n    ${kind === "median-finder" ? "results.append(instance.findMedian())" : ""}\n    output = results[-1] if "${kind}" == "median-finder" else results\n    print("${RESULT_MARKER}${index}:" + json.dumps({"ok": True, "value": output}, separators=(",", ":")))\nexcept Exception as error:\n    print("${RESULT_MARKER}${index}:" + json.dumps({"ok": False, "error": str(error)}, separators=(",", ":")))`;
  return `try:\n    input_data = ${literal}\n    instance = ${className}()\n    results = [trailgrad_operation_value("${kind}", operation[0], getattr(instance, operation[0])(*operation[1:])) for operation in input_data]\n    print("${RESULT_MARKER}${index}:" + json.dumps({"ok": True, "value": results}, separators=(",", ":")))\nexcept Exception as error:\n    print("${RESULT_MARKER}${index}:" + json.dumps({"ok": False, "error": str(error)}, separators=(",", ":")))`;
}

/**
 * Java runner for the class-operation questions.
 *
 * The call sequence is known when the harness is built, so it is unrolled into
 * typed statements rather than dispatched by name — Java has no way to call a
 * method from a string without reflection, and unrolling keeps the generated
 * program something a person can read when it fails to compile.
 *
 * `results` is a `List<Object>`; every return type autoboxes into it, and the
 * existing `json` already walks an Iterable.
 */
function javaOperationHarness(code: string, testCases: CodeTestCase[]): string {
  const kind = operationKind(testCases[0]?.adapter);
  const className = operationClassName(kind);
  const candidateCode = code.replace(/\b(?:public\s+)?class\s+Main\b/, "class CandidateSolution");
  if (candidateCode === code) throw new Error("Java code must contain class Main.");
  const qualified = `CandidateSolution.${className}`;

  const call = (operation: unknown[]) => {
    const name = operation[0] as string;
    const args = operation.slice(1).map((value) => javaLiteral(value)).join(", ");
    const invocation = `instance.${name}(${args})`;
    return returnsNothing(kind, name)
      ? `${invocation}; results.add(null);`
      : `results.add(${invocation});`;
  };

  const body = (testCase: CodeTestCase) => {
    const input = testCase.arguments;
    if (kind === "browser-history") {
      const pages = input[0] as unknown[];
      const visits = pages
        .slice(1)
        .map((page) => `instance.visit(${javaLiteral(page)}); results.add(null);`);
      return [
        `${qualified} instance = new ${qualified}(${javaLiteral(pages[0])});`,
        "results.add(null);",
        ...visits,
        ...input.slice(1).map((operation) => call(operation as unknown[]))
      ];
    }
    if (kind === "lru-cache" || kind === "circular-queue") {
      const constructorArguments = (input[0] as unknown[])
        .map((value) => javaLiteral(value))
        .join(", ");
      return [
        `${qualified} instance = new ${qualified}(${constructorArguments});`,
        ...input.slice(1).map((operation) => call(operation as unknown[]))
      ];
    }
    if (kind === "stock-span" || kind === "median-finder") {
      const values = (input[0] as unknown[]).map((value) => javaLiteral(value));
      const each =
        kind === "stock-span"
          ? values.map((value) => `results.add(instance.next(${value}));`)
          : [
              ...values.map((value) => `instance.addNum(${value});`),
              "results.add(instance.findMedian());"
            ];
      return [`${qualified} instance = new ${qualified}();`, ...each];
    }
    return [
      `${qualified} instance = new ${qualified}();`,
      ...input.map((operation) => call(operation as unknown[]))
    ];
  };

  const runs = testCases
    .map(
      (testCase, index) => `    static void run${index}() {
        try {
            java.util.List<Object> results = new java.util.ArrayList<>();
            ${body(testCase).join("\n            ")}
            System.out.println(String.format("${RESULT_MARKER}%d:{%cok%c:true,%cvalue%c:%s}", ${index}, 34, 34, 34, 34, json(${kind === "median-finder" ? "results.get(results.size() - 1)" : "results"})));
        } catch (Throwable error) {
            System.out.println(String.format("${RESULT_MARKER}%d:{%cok%c:false,%cerror%c:%s}", ${index}, 34, 34, 34, 34, json(error.getMessage())));
        }
    }`
    )
    .join("\n");

  const imports = candidateCode.match(/^(?:import\s+[^;]+;\s*)*/)?.[0] ?? "";
  const candidateBody = candidateCode.slice(imports.length);
  return `${imports}
${candidateBody}

class Main {
${runs}

    static String json(Object value) {
        if (value == null) return "null";
        if (value instanceof Number || value instanceof Boolean) return value.toString();
        if (value instanceof Character || value instanceof String) {
            String slash = String.valueOf((char) 92);
            String quote = String.valueOf((char) 34);
            return quote + value.toString().replace(slash, slash + slash).replace(quote, slash + quote) + quote;
        }
        if (value instanceof Iterable<?>) {
            StringBuilder output = new StringBuilder("[");
            boolean first = true;
            for (Object item : (Iterable<?>) value) {
                if (!first) output.append(',');
                output.append(json(item));
                first = false;
            }
            return output.append(']').toString();
        }
        return json(value.toString());
    }

    public static void main(String[] args) {
${testCases.map((_, index) => `        run${index}();`).join("\n")}
    }
}
`;
}

/**
 * C++ runner for the class-operation questions.
 *
 * Same unrolling as the Java one, but the results are accumulated as JSON
 * fragments rather than a list: C++ has no cheap heterogeneous container, and
 * `trailgradJson` is already overloaded for every return type these classes use
 * — int, bool, double and string — so each call formats itself at the point it
 * is made.
 */
function cppOperationHarness(code: string, testCases: CodeTestCase[]): string {
  const kind = operationKind(testCases[0]?.adapter);
  const className = operationClassName(kind);
  const candidateCode = code.replace(/\bint\s+main\s*\([^)]*\)/, "int trailgradCandidateMain()");

  const call = (operation: unknown[]) => {
    const name = operation[0] as string;
    const args = operation.slice(1).map((value) => cppLiteral(value)).join(", ");
    const invocation = `instance.${name}(${args})`;
    return returnsNothing(kind, name)
      ? `${invocation}; parts.push_back("null");`
      : `parts.push_back(trailgradJson(${invocation}));`;
  };

  const body = (testCase: CodeTestCase) => {
    const input = testCase.arguments;
    if (kind === "browser-history") {
      const pages = input[0] as unknown[];
      return [
        `${className} instance(${cppLiteral(pages[0])});`,
        'parts.push_back("null");',
        ...pages
          .slice(1)
          .map((page) => `instance.visit(${cppLiteral(page)}); parts.push_back("null");`),
        ...input.slice(1).map((operation) => call(operation as unknown[]))
      ];
    }
    if (kind === "lru-cache" || kind === "circular-queue") {
      const constructorArguments = (input[0] as unknown[])
        .map((value) => cppLiteral(value))
        .join(", ");
      return [
        `${className} instance(${constructorArguments});`,
        ...input.slice(1).map((operation) => call(operation as unknown[]))
      ];
    }
    if (kind === "stock-span" || kind === "median-finder") {
      const values = (input[0] as unknown[]).map((value) => cppLiteral(value));
      const each =
        kind === "stock-span"
          ? values.map((value) => `parts.push_back(trailgradJson(instance.next(${value})));`)
          : [
              ...values.map((value) => `instance.addNum(${value});`),
              "parts.push_back(trailgradJson(instance.findMedian()));"
            ];
      return [`${className} instance;`, ...each];
    }
    return [
      `${className} instance;`,
      ...input.map((operation) => call(operation as unknown[]))
    ];
  };

  const runs = testCases
    .map(
      (testCase, index) => `    try {
        vector<string> parts;
        ${body(testCase).join("\n        ")}
        string joined;
        for (size_t i = 0; i < parts.size(); i++) { if (i) joined += ","; joined += parts[i]; }
        cout << "${RESULT_MARKER}${index}:{" << char(34) << "ok" << char(34) << ":true," << char(34) << "value" << char(34) << ":" << ${kind === "median-finder" ? "(parts.empty() ? string(\"null\") : parts.back())" : '("[" + joined + "]")'} << "}" << endl;
    } catch (const exception& error) {
        cout << "${RESULT_MARKER}${index}:{" << char(34) << "ok" << char(34) << ":false," << char(34) << "error" << char(34) << ":" << trailgradJson(string(error.what())) << "}" << endl;
    }`
    )
    .join("\n");

  const includes =
    candidateCode.match(/^(?:#include\s+[^\n]+\n|using\s+namespace\s+[^;]+;\s*)*/)?.[0] ?? "";
  const candidateBody = candidateCode.slice(includes.length);
  return `${includes}
${candidateBody}

string trailgradJson(const string& value) {
    string output(1, char(34));
    for (char character : value) {
        if (character == char(92) || character == char(34)) output += char(92);
        output += character;
    }
    return output + char(34);
}
string trailgradJson(const char* value) { return trailgradJson(string(value)); }
string trailgradJson(bool value) { return value ? "true" : "false"; }
template <typename T>
string trailgradJson(T value) { return to_string(value); }

int main() {
${runs}
    return 0;
}
`;
}

function adapterForSlug(slug: string): TestAdapter | undefined {
  const operationAdapters: Record<string, TestAdapter> = {
    "design-browser-history": "operations:browser-history",
    "lru-cache": "operations:lru-cache",
    "min-stack": "operations:min-stack",
    "implement-queue-using-stacks": "operations:queue",
    "implement-stack-using-queues": "operations:stack",
    "design-circular-queue": "operations:circular-queue",
    "online-stock-span": "operations:stock-span",
    "time-based-key-value-store": "operations:time-map",
    "find-median-from-data-stream": "operations:median-finder",
    "implement-trie-prefix-tree": "operations:trie",
    "design-add-and-search-words-data-structure": "operations:word-dictionary"
  };
  if (operationAdapters[slug]) return operationAdapters[slug];
  const linkedListSlugs = new Set([
    "partition-list",
    "reverse-linked-list",
    "merge-two-sorted-lists",
    "remove-nth-node-from-end-of-list",
    "swap-nodes-in-pairs",
    "odd-even-linked-list",
    "reverse-linked-list-ii",
    "rotate-list",
    "sort-list",
    "reverse-nodes-in-k-group"
  ]);
  const treeOutputSlugs = new Set(["invert-binary-tree"]);
  const treeNodeValueSlugs = new Set(["lowest-common-ancestor-of-a-binary-tree"]);
  const treeTargetValueSlugs = new Set(["all-nodes-distance-k-in-binary-tree"]);
  const treeInputSlugs = new Set([
    "maximum-depth-of-binary-tree",
    "minimum-depth-of-binary-tree",
    "same-tree",
    "symmetric-tree",
    "subtree-of-another-tree",
    "balanced-binary-tree",
    "diameter-of-binary-tree",
    "path-sum",
    "sum-root-to-leaf-numbers",
    "path-sum-ii",
    "binary-tree-level-order-traversal",
    "binary-tree-zigzag-level-order-traversal",
    "binary-tree-right-side-view",
    "populating-next-right-pointers-in-each-node",
    "validate-binary-search-tree",
    "kth-smallest-element-in-a-bst",
    "path-sum-iii",
    "house-robber-iii",
    "binary-tree-maximum-path-sum",
    "binary-tree-cameras",
    "count-complete-tree-nodes",
    "vertical-order-traversal-of-a-binary-tree",
    "maximum-width-of-binary-tree"
  ]);
  if (linkedListSlugs.has(slug)) return "linked-list";
  if (slug === "reorder-list") return "linked-list-mutated";
  // These three build a structure a plain array cannot express — a cycle, or two
  // lists sharing a tail. Without them the candidate was handed `pos` / `skipA`
  // and could answer with the argument.
  if (slug === "linked-list-cycle") return "linked-list-cycle";
  if (slug === "linked-list-cycle-ii") return "linked-list-cycle-entry";
  if (slug === "intersection-of-two-linked-lists") return "linked-list-intersection";
  // These two ask for a *deep copy*, which an array encoding cannot check:
  // handed the array straight through, `return head` passed every case. The
  // adapters build real nodes and the output check rejects a result that
  // hands the originals back.
  if (slug === "copy-list-with-random-pointer") return "linked-list-random";
  if (slug === "clone-graph") return "graph-clone";
  if (slug === "recover-binary-search-tree") return "tree-mutated-output";
  if (slug === "flatten-binary-tree-to-linked-list") return "tree-right-chain";
  if (treeOutputSlugs.has(slug)) return "tree-output";
  if (treeNodeValueSlugs.has(slug)) return "tree-node-value";
  if (treeTargetValueSlugs.has(slug)) return "tree-target-value";
  if (treeInputSlugs.has(slug)) return "tree-input";
  // Arguments are ordinary arrays; only the *returned* tree is serialized. The
  // alternative was making the candidate emit the level-order array by hand —
  // which Java and C++ cannot even express, because their `int[]`/`vector<int>`
  // has no null.
  if (slug === "convert-sorted-array-to-binary-search-tree") return "tree-result";
  if (slug === "construct-binary-tree-from-preorder-and-inorder-traversal") return "tree-result";
  return undefined;
}

function javascriptAdapterHelpers(): string {
  return `
class ListNode { constructor(val, next = null) { this.val = val; this.next = next; } }
class TreeNode { constructor(val, left = null, right = null) { this.val = val; this.left = left; this.right = right; } }
function trailgradBuildList(values) { let head = null; let tail = null; for (const value of values) { const node = new ListNode(value); if (!head) head = node; else tail.next = node; tail = node; } return head; }
function trailgradListToArray(head) { const values = []; const seen = new Set(); let node = head; while (node && !seen.has(node) && values.length < 10000) { seen.add(node); values.push(node.val); node = node.next; } return values; }
function trailgradBuildTree(values) { if (!values.length || values[0] === null) return null; const nodes = values.map(value => value === null ? null : new TreeNode(value)); let child = 1; for (const node of nodes) { if (!node) continue; node.left = nodes[child++] ?? null; node.right = nodes[child++] ?? null; } return nodes[0]; }
function trailgradTreeToArray(root) { if (!root) return []; const values = []; const queue = [root]; while (queue.length) { const node = queue.shift(); if (!node) { values.push(null); continue; } values.push(node.val); queue.push(node.left, node.right); } while (values[values.length - 1] === null) values.pop(); return values; }
function trailgradFindTreeNode(root, value) { if (!root) return null; const queue = [root]; while (queue.length) { const node = queue.shift(); if (node.val === value) return node; if (node.left) queue.push(node.left); if (node.right) queue.push(node.right); } return null; }
function trailgradTreeToRightChain(root) { const values = []; const seen = new Set(); let node = root; while (node && !seen.has(node) && values.length < 10000) { seen.add(node); values.push(node.val); if (node.right) values.push(null); node = node.right; } return values; }
class RandomListNode { constructor(val) { this.val = val; this.next = null; this.random = null; } }
class GraphNode { constructor(val, neighbors) { this.val = val; this.neighbors = neighbors || []; } }
function trailgradBuildRandomList(pairs) { const nodes = pairs.map(pair => new RandomListNode(pair[0])); nodes.forEach((node, index) => { node.next = nodes[index + 1] ?? null; node.random = pairs[index][1] === null ? null : nodes[pairs[index][1]]; }); return nodes[0] ?? null; }
function trailgradRandomListToArray(head, originals) { const nodes = []; let node = head; while (node && nodes.length < 10000) { if (originals.has(node)) return "returned the original nodes rather than a copy"; nodes.push(node); node = node.next; } const index = new Map(nodes.map((item, i) => [item, i])); return nodes.map(item => [item.val, item.random === null || item.random === undefined ? null : index.get(item.random) ?? null]); }
function trailgradBuildGraph(adjacency) { if (!adjacency.length) return null; const nodes = adjacency.map((_, index) => new GraphNode(index + 1)); nodes.forEach((node, index) => { node.neighbors = adjacency[index].map(label => nodes[label - 1]); }); return nodes[0]; }
function trailgradGraphToAdjacency(start, originals) { if (!start) return []; const seen = new Map(); const stack = [start]; while (stack.length) { const node = stack.pop(); if (seen.has(node)) continue; if (originals.has(node)) return "returned the original nodes rather than a copy"; seen.set(node, true); for (const neighbor of node.neighbors) stack.push(neighbor); } const byLabel = [...seen.keys()].sort((a, b) => a.val - b.val); return byLabel.map(node => node.neighbors.map(neighbor => neighbor.val)); }
function trailgradCollectRandomNodes(head) { const seen = new Set(); let node = head; while (node && seen.size < 10000) { seen.add(node); node = node.next; } return seen; }
function trailgradCollectGraphNodes(start) { const seen = new Set(); const stack = start ? [start] : []; while (stack.length) { const node = stack.pop(); if (seen.has(node)) continue; seen.add(node); for (const neighbor of node.neighbors) stack.push(neighbor); } return seen; }
function trailgradBuiltInts(n, lo, hi, seed) { const range = hi - lo + 1; let state = seed; const out = new Array(n); for (let i = 0; i < n; i++) { state = (state * 48271) % 2147483647; out[i] = lo + (state % range); } return out; }
function trailgradBuiltSequence(n, start, step) { const out = new Array(n); for (let i = 0; i < n; i++) out[i] = start + i * step; return out; }
function trailgradBuildCycleList(values, pos) { const head = trailgradBuildList(values); if (pos < 0 || head === null) return head; let tail = head; while (tail.next) tail = tail.next; let entry = head; for (let i = 0; i < pos; i++) entry = entry.next; tail.next = entry; return head; }
function trailgradNodeIndex(head, target) { if (!target) return -1; const seen = new Set(); let node = head; let index = 0; while (node && !seen.has(node)) { if (node === target) return index; seen.add(node); node = node.next; index++; } return -1; }
function trailgradNodeValueIn(head, target) { return trailgradNodeIndex(head, target) === -1 ? null : target.val; }
function trailgradBuildIntersection(valuesA, valuesB, skipA, skipB) { const headA = trailgradBuildList(valuesA); if (skipA >= valuesA.length || skipB >= valuesB.length) return [headA, trailgradBuildList(valuesB)]; let shared = headA; for (let i = 0; i < skipA; i++) shared = shared.next; if (skipB === 0) return [headA, shared]; const headB = trailgradBuildList(valuesB.slice(0, skipB)); let tailB = headB; while (tailB.next) tailB = tailB.next; tailB.next = shared; return [headA, headB]; }
function trailgradAdaptArguments(values, adapter) { if (adapter === "linked-list-random") return [trailgradBuildRandomList(values[0])]; if (adapter === "graph-clone") return [trailgradBuildGraph(values[0])]; if (adapter === "linked-list-cycle" || adapter === "linked-list-cycle-entry") return [trailgradBuildCycleList(values[0], values[1])]; if (adapter === "linked-list-intersection") return trailgradBuildIntersection(values[0], values[1], values[2], values[3]); if (adapter === "linked-list" || adapter === "linked-list-mutated") return values.map(value => Array.isArray(value) ? trailgradBuildList(value) : value); if (adapter === "tree-node-value" || adapter === "tree-target-value") { const root = trailgradBuildTree(values[0]); return [root, ...values.slice(1).map((value, index) => index === 0 || adapter === "tree-node-value" ? trailgradFindTreeNode(root, value) : value)]; } if (adapter === "tree-input" || adapter === "tree-output" || adapter === "tree-mutated-output" || adapter === "tree-right-chain") return values.map(value => Array.isArray(value) && (value.length === 0 || !Array.isArray(value[0])) ? trailgradBuildTree(value) : value); return values; }
function trailgradAdaptOutput(value, adapter, argumentsList) { if (adapter === "linked-list-random") return trailgradRandomListToArray(value, trailgradCollectRandomNodes(argumentsList[0])); if (adapter === "graph-clone") return trailgradGraphToAdjacency(value, trailgradCollectGraphNodes(argumentsList[0])); if (adapter === "tree-result") return trailgradTreeToArray(value); if (adapter === "linked-list-cycle-entry") return trailgradNodeIndex(argumentsList[0], value); if (adapter === "linked-list-intersection") return trailgradNodeValueIn(argumentsList[0], value); if (adapter === "linked-list" || adapter === "linked-list-mutated") return trailgradListToArray(value); if (adapter === "tree-output" || adapter === "tree-mutated-output") return trailgradTreeToArray(value); if (adapter === "tree-right-chain") return trailgradTreeToRightChain(value); if (adapter === "tree-node-value") return value ? value.val : null; return value; }
`;
}

function pythonAdapterHelpers(): string {
  return `
class ListNode:
    def __init__(self, val=0, next=None): self.val, self.next = val, next
class TreeNode:
    def __init__(self, val=0, left=None, right=None): self.val, self.left, self.right = val, left, right
def trailgrad_build_list(values):
    head = tail = None
    for value in values:
        node = ListNode(value)
        if head is None: head = node
        else: tail.next = node
        tail = node
    return head
def trailgrad_list_to_array(head):
    values, seen, node = [], set(), head
    while node is not None and id(node) not in seen and len(values) < 10000:
        seen.add(id(node)); values.append(node.val); node = node.next
    return values
def trailgrad_build_tree(values):
    if not values or values[0] is None: return None
    nodes = [None if value is None else TreeNode(value) for value in values]
    child = 1
    for node in nodes:
        if node is None: continue
        node.left = nodes[child] if child < len(nodes) else None; child += 1
        node.right = nodes[child] if child < len(nodes) else None; child += 1
    return nodes[0]
def trailgrad_tree_to_array(root):
    if root is None: return []
    values, queue = [], [root]
    while queue:
        node = queue.pop(0)
        if node is None: values.append(None); continue
        values.append(node.val); queue.extend([node.left, node.right])
    while values and values[-1] is None: values.pop()
    return values
def trailgrad_tree_to_right_chain(root):
    values, seen, node = [], set(), root
    while node is not None and id(node) not in seen and len(values) < 10000:
        seen.add(id(node)); values.append(node.val)
        if node.right is not None: values.append(None)
        node = node.right
    return values
def trailgrad_find_tree_node(root, value):
    queue = [root] if root is not None else []
    while queue:
        node = queue.pop(0)
        if node.val == value: return node
        if node.left is not None: queue.append(node.left)
        if node.right is not None: queue.append(node.right)
    return None
class RandomListNode:
    def __init__(self, val=0, next=None, random=None): self.val, self.next, self.random = val, next, random
class GraphNode:
    def __init__(self, val=0, neighbors=None): self.val, self.neighbors = val, neighbors if neighbors is not None else []
def trailgrad_build_random_list(pairs):
    nodes = [RandomListNode(pair[0]) for pair in pairs]
    for index, node in enumerate(nodes):
        node.next = nodes[index + 1] if index + 1 < len(nodes) else None
        node.random = None if pairs[index][1] is None else nodes[pairs[index][1]]
    return nodes[0] if nodes else None
def trailgrad_collect_random_nodes(head):
    seen, node = set(), head
    while node is not None and len(seen) < 10000:
        seen.add(id(node)); node = node.next
    return seen
def trailgrad_random_list_to_array(head, originals):
    nodes, node = [], head
    while node is not None and len(nodes) < 10000:
        if id(node) in originals: return "returned the original nodes rather than a copy"
        nodes.append(node); node = node.next
    index = {id(item): i for i, item in enumerate(nodes)}
    return [[item.val, None if item.random is None else index.get(id(item.random))] for item in nodes]
def trailgrad_build_graph(adjacency):
    if not adjacency: return None
    nodes = [GraphNode(i + 1) for i in range(len(adjacency))]
    for index, node in enumerate(nodes):
        node.neighbors = [nodes[label - 1] for label in adjacency[index]]
    return nodes[0]
def trailgrad_collect_graph_nodes(start):
    seen, stack = set(), ([start] if start is not None else [])
    while stack:
        node = stack.pop()
        if id(node) in seen: continue
        seen.add(id(node)); stack.extend(node.neighbors)
    return seen
def trailgrad_graph_to_adjacency(start, originals):
    if start is None: return []
    seen, order, stack = set(), [], [start]
    while stack:
        node = stack.pop()
        if id(node) in seen: continue
        if id(node) in originals: return "returned the original nodes rather than a copy"
        seen.add(id(node)); order.append(node); stack.extend(node.neighbors)
    order.sort(key=lambda item: item.val)
    return [[neighbor.val for neighbor in item.neighbors] for item in order]
def trailgrad_built_ints(n, lo, hi, seed):
    span = hi - lo + 1
    state = seed
    out = []
    for _ in range(n):
        state = (state * 48271) % 2147483647
        out.append(lo + state % span)
    return out
def trailgrad_built_sequence(n, start, step):
    return [start + i * step for i in range(n)]
def trailgrad_build_cycle_list(values, pos):
    head = trailgrad_build_list(values)
    if pos < 0 or head is None: return head
    tail = head
    while tail.next is not None: tail = tail.next
    entry = head
    for _ in range(pos): entry = entry.next
    tail.next = entry
    return head
def trailgrad_node_index(head, target):
    if target is None: return -1
    seen, node, index = set(), head, 0
    while node is not None and id(node) not in seen:
        if node is target: return index
        seen.add(id(node)); node = node.next; index += 1
    return -1
def trailgrad_node_value_in(head, target):
    return None if trailgrad_node_index(head, target) == -1 else target.val
def trailgrad_build_intersection(values_a, values_b, skip_a, skip_b):
    head_a = trailgrad_build_list(values_a)
    if skip_a >= len(values_a) or skip_b >= len(values_b): return [head_a, trailgrad_build_list(values_b)]
    shared = head_a
    for _ in range(skip_a): shared = shared.next
    if skip_b == 0: return [head_a, shared]
    head_b = trailgrad_build_list(values_b[:skip_b])
    tail_b = head_b
    while tail_b.next is not None: tail_b = tail_b.next
    tail_b.next = shared
    return [head_a, head_b]
def trailgrad_adapt_arguments(values, adapter):
    if adapter == "linked-list-random": return [trailgrad_build_random_list(values[0])]
    if adapter == "graph-clone": return [trailgrad_build_graph(values[0])]
    if adapter in ("linked-list-cycle", "linked-list-cycle-entry"): return [trailgrad_build_cycle_list(values[0], values[1])]
    if adapter == "linked-list-intersection": return trailgrad_build_intersection(values[0], values[1], values[2], values[3])
    if adapter in ("linked-list", "linked-list-mutated"): return [trailgrad_build_list(value) if isinstance(value, list) else value for value in values]
    if adapter in ("tree-node-value", "tree-target-value"):
        root = trailgrad_build_tree(values[0])
        return [root] + [trailgrad_find_tree_node(root, value) if index == 0 or adapter == "tree-node-value" else value for index, value in enumerate(values[1:])]
    if adapter in ("tree-input", "tree-output", "tree-mutated-output", "tree-right-chain"): return [trailgrad_build_tree(value) if isinstance(value, list) and (not value or not isinstance(value[0], list)) else value for value in values]
    return values
def trailgrad_adapt_output(value, adapter, arguments_list):
    if adapter == "linked-list-random": return trailgrad_random_list_to_array(value, trailgrad_collect_random_nodes(arguments_list[0]))
    if adapter == "graph-clone": return trailgrad_graph_to_adjacency(value, trailgrad_collect_graph_nodes(arguments_list[0]))
    if adapter == "tree-result": return trailgrad_tree_to_array(value)
    if adapter == "linked-list-cycle-entry": return trailgrad_node_index(arguments_list[0], value)
    if adapter == "linked-list-intersection": return trailgrad_node_value_in(arguments_list[0], value)
    if adapter in ("linked-list", "linked-list-mutated"): return trailgrad_list_to_array(value)
    if adapter in ("tree-output", "tree-mutated-output"): return trailgrad_tree_to_array(value)
    if adapter == "tree-right-chain": return trailgrad_tree_to_right_chain(value)
    if adapter == "tree-node-value": return value.val if value is not None else None
    return value
`;
}

function javaHarness(code: string, functionName: string, testCases: CodeTestCase[]): string {
  const candidateCode = code.replace(/\b(?:public\s+)?class\s+Main\b/, "class CandidateSolution");
  if (candidateCode === code) throw new Error("Java code must contain class Main.");
  const argumentTypeHints = mergedArgumentShapes(testCases);
  const runs = testCases
    .map((testCase, index) => {
      // The cycle and intersection adapters consume trailing arguments to build
      // the structure, so they declare their own variables and call the
      // candidate with fewer parameters than the case carries.
      if (testCase.adapter === "linked-list-cycle" || testCase.adapter === "linked-list-cycle-entry") {
        const values = javaLiteral(testCase.arguments[0], argumentTypeHints[0]);
        const pos = javaLiteral(testCase.arguments[1]);
        const head = `argument${index}_0`;
        const call = `CandidateSolution.${functionName}(${head})`;
        const output =
          testCase.adapter === "linked-list-cycle-entry" ? `javaNodeIndex(${head}, ${call})` : call;
        return `ListNode ${head} = javaBuildCycleList(${values}, ${pos});\n        runCase(${index}, () -> ${output});`;
      }
      if (testCase.adapter === "linked-list-intersection") {
        const pair = `argument${index}_pair`;
        const call = `CandidateSolution.${functionName}(${pair}[0], ${pair}[1])`;
        return `ListNode[] ${pair} = javaBuildIntersection(${javaLiteral(testCase.arguments[0], argumentTypeHints[0])}, ${javaLiteral(testCase.arguments[1], argumentTypeHints[1])}, ${javaLiteral(testCase.arguments[2])}, ${javaLiteral(testCase.arguments[3])});\n        runCase(${index}, () -> javaNodeValueIn(${pair}[0], ${call}));`;
      }
      if (testCase.adapter === "tree-right-chain") {
        const root = javaAdapterDeclaration(testCase.arguments[0], index, 0, "tree");
        const argumentsList = testCase.arguments
          .map((argument, argumentIndex) =>
            javaAdapterReference(testCase, argument, index, argumentIndex)
          )
          .join(", ");
        return `${root}\n        runTreeMutation(${index}, argument${index}_0, () -> CandidateSolution.${functionName}(${argumentsList}), true);`;
      }
      if (
        (testCase.adapter === "linked-list-mutated" ||
          testCase.adapter === "tree-mutated-output") &&
        testCase.mode !== "mutated-first-argument"
      ) {
        const declarations = testCase.arguments
          .map((argument, argumentIndex) =>
            javaAdapterDeclaration(argument, index, argumentIndex, testCase.adapter ?? "tree-input")
          )
          .filter(Boolean)
          .join("\n        ");
        const argumentsList = testCase.arguments
          .map((argument, argumentIndex) =>
            javaAdapterReference(testCase, argument, index, argumentIndex)
          )
          .join(", ");
        return `${declarations}\n        runAdaptedMutation(${index}, argument${index}_0, () -> CandidateSolution.${functionName}(${argumentsList}), "${testCase.adapter}");`;
      }
      if (testCase.adapter && testCase.mode !== "mutated-first-argument") {
        const declarations = testCase.arguments
          .map((argument, argumentIndex) =>
            javaAdapterDeclaration(argument, index, argumentIndex, testCase.adapter ?? "tree-input")
          )
          .filter(Boolean)
          .join("\n        ");
        const argumentsList = testCase.arguments
          .map((argument, argumentIndex) =>
            javaAdapterReference(testCase, argument, index, argumentIndex)
          )
          .join(", ");
        const call = `CandidateSolution.${functionName}(${argumentsList})`;
        const output =
          testCase.adapter === "linked-list"
            ? `javaListToArray(${call})`
            : testCase.adapter === "tree-output" || testCase.adapter === "tree-result"
              ? `javaTreeToArray(${call})`
              : testCase.adapter === "tree-node-value"
                ? `javaNodeValue(${call})`
                : call;
        return `${declarations}\n        runCase(${index}, () -> ${output});`;
      }
      const declarations =
        testCase.mode === "mutated-first-argument"
          ? testCase.arguments
              .map(
                (argument, argumentIndex) =>
                  `${javaType(argument, argumentTypeHints[argumentIndex])} argument${index}_${argumentIndex} = ${argumentSource(testCase, argumentIndex, "java", javaLiteral(argument, argumentTypeHints[argumentIndex]))};`
              )
              .join("\n        ")
          : "";
      const argumentsList =
        testCase.mode === "mutated-first-argument"
          ? testCase.arguments
              .map((_, argumentIndex) => `argument${index}_${argumentIndex}`)
              .join(", ")
          : testCase.arguments
              .map((argument, argumentIndex) =>
                argumentSource(
                  testCase,
                  argumentIndex,
                  "java",
                  javaLiteral(argument, argumentTypeHints[argumentIndex])
                )
              )
              .join(", ");
      if (testCase.mode === "mutated-first-argument") {
        return `${declarations}\n        runMutatingCase(${index}, argument${index}_0, () -> CandidateSolution.${functionName}(${argumentsList}));`;
      }
      return `runCase(${index}, () -> CandidateSolution.${functionName}(${argumentsList}));`;
    })
    .join("\n        ");
  const imports = candidateCode.match(/^(?:import\s+[^;]+;\s*)*/)?.[0] ?? "";
  const candidateBody = candidateCode.slice(imports.length);
  return `${imports}${javaAdapterTypes()}
${candidateBody}

class Main {
    interface CaseRunner { Object run() throws Exception; }

    static void runCase(int index, CaseRunner runner) {
        try {
            System.out.println(String.format("${RESULT_MARKER}%d:{%cok%c:true,%cvalue%c:%s}", index, 34, 34, 34, 34, json(runner.run())));
        } catch (Throwable error) {
            System.out.println(String.format("${RESULT_MARKER}%d:{%cok%c:false,%cerror%c:%s}", index, 34, 34, 34, 34, json(error.getMessage())));
        }
    }

    static void runMutatingCase(int index, Object value, Runnable runner) {
        try {
            runner.run();
            System.out.println(String.format("${RESULT_MARKER}%d:{%cok%c:true,%cvalue%c:%s}", index, 34, 34, 34, 34, json(value)));
        } catch (Throwable error) {
            System.out.println(String.format("${RESULT_MARKER}%d:{%cok%c:false,%cerror%c:%s}", index, 34, 34, 34, 34, json(error.getMessage())));
        }
    }

    static void runTreeMutation(int index, TreeNode root, Runnable runner, boolean rightChain) {
        try {
            runner.run();
            System.out.println(String.format("${RESULT_MARKER}%d:{%cok%c:true,%cvalue%c:%s}", index, 34, 34, 34, 34, json(rightChain ? javaTreeRightChain(root) : javaTreeToArray(root))));
        } catch (Throwable error) {
            System.out.println(String.format("${RESULT_MARKER}%d:{%cok%c:false,%cerror%c:%s}", index, 34, 34, 34, 34, json(error.getMessage())));
        }
    }

    static void runAdaptedMutation(int index, Object value, Runnable runner, String adapter) {
        try {
            runner.run(); Object output = adapter.equals("linked-list-mutated") ? javaListToArray((ListNode) value) : javaTreeToArray((TreeNode) value);
            System.out.println(String.format("${RESULT_MARKER}%d:{%cok%c:true,%cvalue%c:%s}", index, 34, 34, 34, 34, json(output)));
        } catch (Throwable error) {
            System.out.println(String.format("${RESULT_MARKER}%d:{%cok%c:false,%cerror%c:%s}", index, 34, 34, 34, 34, json(error.getMessage())));
        }
    }

    static int[] trailgradBuiltInts(int n, int lo, int hi, int seed) {
        int span = hi - lo + 1;
        long state = seed;
        int[] out = new int[n];
        for (int i = 0; i < n; i++) { state = (state * 48271L) % 2147483647L; out[i] = (int) (lo + state % span); }
        return out;
    }

    static int[] trailgradBuiltSequence(int n, int start, int step) {
        int[] out = new int[n];
        for (int i = 0; i < n; i++) out[i] = start + i * step;
        return out;
    }

    static ListNode javaBuildList(int[] values) {
        ListNode head = null, tail = null;
        for (int value : values) { ListNode node = new ListNode(value); if (head == null) head = node; else tail.next = node; tail = node; }
        return head;
    }

    static ListNode javaBuildCycleList(int[] values, int pos) {
        ListNode head = javaBuildList(values);
        if (pos < 0 || head == null) return head;
        ListNode tail = head;
        while (tail.next != null) tail = tail.next;
        ListNode entry = head;
        for (int i = 0; i < pos; i++) entry = entry.next;
        tail.next = entry;
        return head;
    }

    static ListNode[] javaBuildIntersection(int[] valuesA, int[] valuesB, int skipA, int skipB) {
        ListNode headA = javaBuildList(valuesA);
        if (skipA >= valuesA.length || skipB >= valuesB.length) return new ListNode[]{headA, javaBuildList(valuesB)};
        ListNode shared = headA;
        for (int i = 0; i < skipA; i++) shared = shared.next;
        if (skipB == 0) return new ListNode[]{headA, shared};
        ListNode headB = javaBuildList(java.util.Arrays.copyOfRange(valuesB, 0, skipB));
        ListNode tailB = headB;
        while (tailB.next != null) tailB = tailB.next;
        tailB.next = shared;
        return new ListNode[]{headA, headB};
    }

    // Identity, not value: a node the candidate built itself is not in the list.
    static int javaNodeIndex(ListNode head, ListNode target) {
        if (target == null) return -1;
        java.util.Set<ListNode> seen = java.util.Collections.newSetFromMap(new java.util.IdentityHashMap<>());
        ListNode node = head;
        int index = 0;
        while (node != null && !seen.contains(node)) {
            if (node == target) return index;
            seen.add(node); node = node.next; index++;
        }
        return -1;
    }

    static Object javaNodeValueIn(ListNode head, ListNode target) {
        return javaNodeIndex(head, target) == -1 ? null : Integer.valueOf(target.val);
    }

    static TreeNode javaBuildTree(Integer[] values) {
        if (values.length == 0 || values[0] == null) return null;
        TreeNode[] nodes = new TreeNode[values.length];
        for (int index = 0; index < values.length; index++) if (values[index] != null) nodes[index] = new TreeNode(values[index]);
        int child = 1;
        for (TreeNode node : nodes) { if (node == null) continue; if (child < nodes.length) node.left = nodes[child++]; if (child < nodes.length) node.right = nodes[child++]; }
        return nodes[0];
    }

    static TreeNode javaFindTreeNode(TreeNode root, int value) {
        if (root == null) return null;
        java.util.ArrayDeque<TreeNode> queue = new java.util.ArrayDeque<>(); queue.add(root);
        while (!queue.isEmpty()) { TreeNode node = queue.remove(); if (node.val == value) return node; if (node.left != null) queue.add(node.left); if (node.right != null) queue.add(node.right); }
        return null;
    }

    static int[] javaListToArray(ListNode head) {
        java.util.ArrayList<Integer> values = new java.util.ArrayList<>(); java.util.HashSet<ListNode> seen = new java.util.HashSet<>();
        while (head != null && !seen.contains(head) && values.size() < 10000) { seen.add(head); values.add(head.val); head = head.next; }
        int[] output = new int[values.size()]; for (int index = 0; index < output.length; index++) output[index] = values.get(index); return output;
    }

    static Object javaNodeValue(TreeNode node) { return node == null ? null : node.val; }

    static java.util.ArrayList<Object> javaTreeToArray(TreeNode root) {
        java.util.ArrayList<Object> values = new java.util.ArrayList<>(); if (root == null) return values;
        java.util.ArrayList<TreeNode> queue = new java.util.ArrayList<>(); queue.add(root); for (int index = 0; index < queue.size(); index++) { TreeNode node = queue.get(index); if (node == null) { values.add(null); continue; } values.add(node.val); queue.add(node.left); queue.add(node.right); }
        while (!values.isEmpty() && values.get(values.size() - 1) == null) values.remove(values.size() - 1); return values;
    }

    static java.util.ArrayList<Object> javaTreeRightChain(TreeNode root) {
        java.util.ArrayList<Object> values = new java.util.ArrayList<>(); java.util.HashSet<TreeNode> seen = new java.util.HashSet<>();
        while (root != null && !seen.contains(root) && values.size() < 10000) { seen.add(root); values.add(root.val); if (root.right != null) values.add(null); root = root.right; }
        return values;
    }

    static String json(Object value) {
        if (value == null) return "null";
        if (value instanceof Number || value instanceof Boolean) return value.toString();
        if (value instanceof Character || value instanceof String) {
            String slash = String.valueOf((char) 92);
            String quote = String.valueOf((char) 34);
            return quote + value.toString().replace(slash, slash + slash).replace(quote, slash + quote) + quote;
        }
        if (value.getClass().isArray()) {
            StringBuilder output = new StringBuilder("[");
            int length = java.lang.reflect.Array.getLength(value);
            for (int index = 0; index < length; index++) {
                if (index > 0) output.append(',');
                output.append(json(java.lang.reflect.Array.get(value, index)));
            }
            return output.append(']').toString();
        }
        if (value instanceof Iterable<?>) {
            StringBuilder output = new StringBuilder("[");
            boolean first = true;
            for (Object item : (Iterable<?>) value) {
                if (!first) output.append(',');
                output.append(json(item));
                first = false;
            }
            return output.append(']').toString();
        }
        return json(value.toString());
    }

    public static void main(String[] args) {
        ${runs}
    }
}
`;
}

function javaAdapterTypes(): string {
  return `class ListNode { int val; ListNode next; ListNode(int val) { this.val = val; } }
class TreeNode { int val; TreeNode left; TreeNode right; TreeNode(int val) { this.val = val; } }
`;
}

function javaAdapterDeclaration(
  value: unknown,
  caseIndex: number,
  argumentIndex: number,
  adapter: TestAdapter | "tree"
): string {
  if (!Array.isArray(value)) return "";
  const name = `argument${caseIndex}_${argumentIndex}`;
  if (adapter === "linked-list" || adapter === "linked-list-mutated")
    return `ListNode ${name} = javaBuildList(${javaLiteral(value)});`;
  // The arguments here are plain arrays; only the return value is a tree.
  if (adapter === "tree-result") return `${javaType(value)} ${name} = ${javaLiteral(value)};`;
  if (
    adapter === "tree" ||
    adapter === "tree-input" ||
    adapter === "tree-output" ||
    adapter === "tree-mutated-output" ||
    adapter === "tree-right-chain" ||
    adapter === "tree-node-value" ||
    adapter === "tree-target-value"
  )
    return `TreeNode ${name} = javaBuildTree(${javaTreeLiteral(value)});`;
  return `${javaType(value)} ${name} = ${javaLiteral(value)};`;
}

function javaAdapterReference(
  testCase: CodeTestCase,
  value: unknown,
  caseIndex: number,
  argumentIndex: number
): string {
  if (testCase.adapter === "tree-node-value" && argumentIndex > 0)
    return `javaFindTreeNode(argument${caseIndex}_0, ${javaLiteral(value)})`;
  if (testCase.adapter === "tree-target-value" && argumentIndex === 1)
    return `javaFindTreeNode(argument${caseIndex}_0, ${javaLiteral(value)})`;
  if (Array.isArray(value) && testCase.adapter) return `argument${caseIndex}_${argumentIndex}`;
  return javaLiteral(value);
}

function javaTreeLiteral(value: unknown[]): string {
  return `new Integer[]{${value.map((item) => (item === null ? "null" : javaLiteral(item))).join(", ")}}`;
}

function cppHarness(code: string, functionName: string, testCases: CodeTestCase[]): string {
  const candidateCode = code.replace(/\bint\s+main\s*\([^)]*\)/, "int trailgradCandidateMain()");
  const argumentTypeHints = mergedArgumentShapes(testCases);
  const runs = testCases
    .map((testCase, index) => {
      if (testCase.adapter === "linked-list-cycle" || testCase.adapter === "linked-list-cycle-entry") {
        const head = `argument${index}_0`;
        const call = `${functionName}(${head})`;
        const output =
          testCase.adapter === "linked-list-cycle-entry" ? `cppNodeIndex(${head}, ${call})` : call;
        return `ListNode* ${head} = cppBuildCycleList(${cppVectorLiteral(testCase.arguments[0] as unknown[])}, ${cppLiteral(testCase.arguments[1])});\n    runCase(${index}, [&]() { return ${output}; });`;
      }
      if (testCase.adapter === "linked-list-intersection") {
        const pair = `argument${index}_pair`;
        const call = `${functionName}(${pair}[0], ${pair}[1])`;
        return `vector<ListNode*> ${pair} = cppBuildIntersection(${cppVectorLiteral(testCase.arguments[0] as unknown[])}, ${cppVectorLiteral(testCase.arguments[1] as unknown[])}, ${cppLiteral(testCase.arguments[2])}, ${cppLiteral(testCase.arguments[3])});\n    runCase(${index}, [&]() { return cppNodeValueIn(${pair}[0], ${call}); });`;
      }
      if (testCase.adapter === "tree-right-chain") {
        const declaration = cppAdapterDeclaration(
          testCase.arguments[0],
          index,
          0,
          "tree-right-chain"
        );
        return `${declaration}\n    runTreeMutation(${index}, argument${index}_0, [&]() { ${functionName}(argument${index}_0); }, true);`;
      }
      if (
        (testCase.adapter === "linked-list-mutated" ||
          testCase.adapter === "tree-mutated-output") &&
        testCase.mode !== "mutated-first-argument"
      ) {
        const declarations = testCase.arguments
          .map((argument, argumentIndex) =>
            cppAdapterDeclaration(argument, index, argumentIndex, testCase.adapter ?? "tree-input")
          )
          .filter(Boolean)
          .join("\n    ");
        const argumentsList = testCase.arguments
          .map((argument, argumentIndex) =>
            cppAdapterReference(testCase, argument, index, argumentIndex)
          )
          .join(", ");
        return `${declarations}\n    runAdaptedMutation(${index}, argument${index}_0, [&]() { ${functionName}(${argumentsList}); }, "${testCase.adapter}");`;
      }
      if (testCase.adapter && testCase.mode !== "mutated-first-argument") {
        const declarations = testCase.arguments
          .map((argument, argumentIndex) =>
            cppAdapterDeclaration(argument, index, argumentIndex, testCase.adapter ?? "tree-input")
          )
          .filter(Boolean)
          .join("\n    ");
        const argumentsList = testCase.arguments
          .map((argument, argumentIndex) =>
            cppAdapterReference(testCase, argument, index, argumentIndex)
          )
          .join(", ");
        const call = `${functionName}(${argumentsList})`;
        const output =
          testCase.adapter === "linked-list"
            ? `cppListToVector(${call})`
            : testCase.adapter === "tree-output" || testCase.adapter === "tree-result"
              ? `cppTreeToVector(${call})`
              : testCase.adapter === "tree-node-value"
                ? `cppNodeValue(${call})`
                : call;
        return `${declarations}\n    runCase(${index}, [&]() { return ${output}; });`;
      }
      const declarations = testCase.arguments
        .map(
          (argument, argumentIndex) =>
            `${cppType(argument, argumentTypeHints[argumentIndex])} argument${index}_${argumentIndex} = ${argumentSource(testCase, argumentIndex, "cpp", cppLiteral(argument))};`
        )
        .join("\n    ");
      const argumentsList = testCase.arguments
        .map((_, argumentIndex) => `argument${index}_${argumentIndex}`)
        .join(", ");
      const runner =
        testCase.mode === "mutated-first-argument"
          ? `runMutatingCase(${index}, argument${index}_0, [&]() { ${functionName}(${argumentsList}); });`
          : `runCase(${index}, [&]() { return ${functionName}(${argumentsList}); });`;
      return `${declarations}\n    ${runner}`;
    })
    .join("\n    ");
  const includes =
    candidateCode.match(/^(?:#include\s+[^\n]+\n|using\s+namespace\s+[^;]+;\s*)*/)?.[0] ?? "";
  const candidateBody = candidateCode.slice(includes.length);
  return `${includes}${cppAdapterTypes()}
${candidateBody}

vector<int> trailgradBuiltInts(int n, int lo, int hi, int seed) { int span = hi - lo + 1; long long state = seed; vector<int> out(n); for (int i = 0; i < n; i++) { state = (state * 48271LL) % 2147483647LL; out[i] = (int) (lo + state % span); } return out; }
vector<int> trailgradBuiltSequence(int n, int start, int step) { vector<int> out(n); for (int i = 0; i < n; i++) out[i] = start + i * step; return out; }
ListNode* cppBuildList(const vector<int>& values) { ListNode* head = nullptr; ListNode* tail = nullptr; for (int value : values) { auto* node = new ListNode(value); if (!head) head = node; else tail->next = node; tail = node; } return head; }
ListNode* cppBuildCycleList(const vector<int>& values, int pos) { ListNode* head = cppBuildList(values); if (pos < 0 || !head) return head; ListNode* tail = head; while (tail->next) tail = tail->next; ListNode* entry = head; for (int i = 0; i < pos; i++) entry = entry->next; tail->next = entry; return head; }
vector<ListNode*> cppBuildIntersection(const vector<int>& valuesA, const vector<int>& valuesB, int skipA, int skipB) { ListNode* headA = cppBuildList(valuesA); if (skipA >= (int)valuesA.size() || skipB >= (int)valuesB.size()) return {headA, cppBuildList(valuesB)}; ListNode* shared = headA; for (int i = 0; i < skipA; i++) shared = shared->next; if (skipB == 0) return {headA, shared}; ListNode* headB = cppBuildList(vector<int>(valuesB.begin(), valuesB.begin() + skipB)); ListNode* tailB = headB; while (tailB->next) tailB = tailB->next; tailB->next = shared; return {headA, headB}; }
int cppNodeIndex(ListNode* head, ListNode* target) { if (!target) return -1; set<ListNode*> seen; ListNode* node = head; int index = 0; while (node && !seen.count(node)) { if (node == target) return index; seen.insert(node); node = node->next; index++; } return -1; }
optional<int> cppNodeValueIn(ListNode* head, ListNode* target) { return cppNodeIndex(head, target) == -1 ? optional<int>(nullopt) : optional<int>(target->val); }
TreeNode* cppBuildTree(const vector<optional<int>>& values) { if (values.empty() || !values[0].has_value()) return nullptr; vector<TreeNode*> nodes(values.size(), nullptr); for (size_t index = 0; index < values.size(); index++) if (values[index].has_value()) nodes[index] = new TreeNode(*values[index]); size_t child = 1; for (auto* node : nodes) { if (!node) continue; if (child < nodes.size()) node->left = nodes[child++]; if (child < nodes.size()) node->right = nodes[child++]; } return nodes[0]; }
TreeNode* cppFindTreeNode(TreeNode* root, int value) { if (!root) return nullptr; queue<TreeNode*> nodes; nodes.push(root); while (!nodes.empty()) { auto* node = nodes.front(); nodes.pop(); if (node->val == value) return node; if (node->left) nodes.push(node->left); if (node->right) nodes.push(node->right); } return nullptr; }
vector<int> cppListToVector(ListNode* head) { vector<int> values; set<ListNode*> seen; while (head && !seen.count(head) && values.size() < 10000) { seen.insert(head); values.push_back(head->val); head = head->next; } return values; }
vector<optional<int>> cppTreeToVector(TreeNode* root) { vector<optional<int>> values; if (!root) return values; queue<TreeNode*> nodes; nodes.push(root); while (!nodes.empty()) { auto* node = nodes.front(); nodes.pop(); if (!node) { values.push_back(nullopt); continue; } values.push_back(node->val); nodes.push(node->left); nodes.push(node->right); } while (!values.empty() && !values.back().has_value()) values.pop_back(); return values; }
vector<optional<int>> cppTreeRightChain(TreeNode* root) { vector<optional<int>> values; set<TreeNode*> seen; while (root && !seen.count(root) && values.size() < 10000) { seen.insert(root); values.push_back(root->val); if (root->right) values.push_back(nullopt); root = root->right; } return values; }
int cppNodeValue(TreeNode* node) { return node ? node->val : 0; }

string trailgradJson(const string& value) {
    string output(1, char(34));
    for (char character : value) {
        if (character == char(92) || character == char(34)) output += char(92);
        output += character;
    }
    return output + char(34);
}
string trailgradJson(const char* value) { return trailgradJson(string(value)); }
string trailgradJson(bool value) { return value ? "true" : "false"; }
template <typename T, enable_if_t<is_arithmetic<T>::value && !is_same<T, bool>::value, int> = 0>
string trailgradJson(T value) { return to_string(value); }
string trailgradJson(const optional<int>& value);
template <typename T>
string trailgradJson(const vector<T>& values) {
    string output = "[";
    for (size_t index = 0; index < values.size(); index++) {
        if (index > 0) output += ',';
        output += trailgradJson(values[index]);
    }
    return output + "]";
}
string trailgradJson(const optional<int>& value) { return value.has_value() ? to_string(*value) : "null"; }
template <typename Runner>
void runCase(int index, Runner runner) {
    try {
        auto value = runner();
        cout << "${RESULT_MARKER}" << index << ":{" << char(34) << "ok" << char(34) << ":true," << char(34) << "value" << char(34) << ":" << trailgradJson(value) << "}" << endl;
    } catch (const exception& error) {
        cout << "${RESULT_MARKER}" << index << ":{" << char(34) << "ok" << char(34) << ":false," << char(34) << "error" << char(34) << ":" << trailgradJson(error.what()) << "}" << endl;
    }
}
template <typename Value, typename Runner>
void runMutatingCase(int index, Value& value, Runner runner) {
    try {
        runner();
        cout << "${RESULT_MARKER}" << index << ":{" << char(34) << "ok" << char(34) << ":true," << char(34) << "value" << char(34) << ":" << trailgradJson(value) << "}" << endl;
    } catch (const exception& error) {
        cout << "${RESULT_MARKER}" << index << ":{" << char(34) << "ok" << char(34) << ":false," << char(34) << "error" << char(34) << ":" << trailgradJson(error.what()) << "}" << endl;
    }
}
template <typename Runner>
void runTreeMutation(int index, TreeNode* root, Runner runner, bool rightChain) {
    try { runner(); auto value = rightChain ? cppTreeRightChain(root) : cppTreeToVector(root); cout << "${RESULT_MARKER}" << index << ":{" << char(34) << "ok" << char(34) << ":true," << char(34) << "value" << char(34) << ":" << trailgradJson(value) << "}" << endl; }
    catch (const exception& error) { cout << "${RESULT_MARKER}" << index << ":{" << char(34) << "ok" << char(34) << ":false," << char(34) << "error" << char(34) << ":" << trailgradJson(error.what()) << "}" << endl; }
}
template <typename Value, typename Runner>
void runAdaptedMutation(int index, Value* value, Runner runner, const string& adapter) {
    try { runner(); cout << "${RESULT_MARKER}" << index << ":{" << char(34) << "ok" << char(34) << ":true," << char(34) << "value" << char(34) << ":"; if (adapter == "linked-list-mutated") cout << trailgradJson(cppListToVector(reinterpret_cast<ListNode*>(value))); else cout << trailgradJson(cppTreeToVector(reinterpret_cast<TreeNode*>(value))); cout << "}" << endl; }
    catch (const exception& error) { cout << "${RESULT_MARKER}" << index << ":{" << char(34) << "ok" << char(34) << ":false," << char(34) << "error" << char(34) << ":" << trailgradJson(error.what()) << "}" << endl; }
}
int main() {
    ${runs}
    return 0;
}
`;
}

function cppAdapterTypes(): string {
  return `struct ListNode { int val; ListNode* next; ListNode(int value) : val(value), next(nullptr) {} };
struct TreeNode { int val; TreeNode* left; TreeNode* right; TreeNode(int value) : val(value), left(nullptr), right(nullptr) {} };
`;
}

function cppAdapterDeclaration(
  value: unknown,
  caseIndex: number,
  argumentIndex: number,
  adapter: TestAdapter
): string {
  if (!Array.isArray(value)) return "";
  const name = `argument${caseIndex}_${argumentIndex}`;
  if (adapter === "linked-list" || adapter === "linked-list-mutated")
    return `ListNode* ${name} = cppBuildList(${cppVectorLiteral(value)});`;
  if (adapter === "tree-result") return `${cppType(value)} ${name} = ${cppLiteral(value)};`;
  return `TreeNode* ${name} = cppBuildTree(${cppOptionalVectorLiteral(value)});`;
}

function cppAdapterReference(
  testCase: CodeTestCase,
  value: unknown,
  caseIndex: number,
  argumentIndex: number
): string {
  if (testCase.adapter === "tree-node-value" && argumentIndex > 0)
    return `cppFindTreeNode(argument${caseIndex}_0, ${cppLiteral(value)})`;
  if (testCase.adapter === "tree-target-value" && argumentIndex === 1)
    return `cppFindTreeNode(argument${caseIndex}_0, ${cppLiteral(value)})`;
  if (Array.isArray(value) && testCase.adapter) return `argument${caseIndex}_${argumentIndex}`;
  return cppLiteral(value);
}

function cppVectorLiteral(value: unknown[]): string {
  return `{${value.map((item) => cppLiteral(item)).join(", ")}}`;
}

function cppOptionalVectorLiteral(value: unknown[]): string {
  return `{${value.map((item) => (item === null ? "nullopt" : `optional<int>(${cppLiteral(item)})`)).join(", ")}}`;
}

function jsLiteral(value: unknown): string {
  return JSON.stringify(value);
}

function pythonLiteral(value: unknown): string {
  if (value === null) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(pythonLiteral).join(", ")}]`;
  return String(value);
}

function javaLiteral(value: unknown, typeHint?: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return String(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    return Number.isInteger(value) && !(typeof typeHint === "number" && !Number.isInteger(typeHint))
      ? String(value)
      : `${value}d`;
  }
  if (Array.isArray(value)) {
    const type = javaArrayType(value, typeHint);
    const nestedHint = Array.isArray(typeHint)
      ? typeHint.find((item) => item !== null && item !== undefined)
      : undefined;
    return `new ${type}{${value.map((item) => javaLiteral(item, nestedHint)).join(", ")}}`;
  }
  throw new Error("Unsupported Java test value.");
}

function javaArrayType(value: unknown[], typeHint?: unknown): string {
  const hinted = Array.isArray(typeHint)
    ? typeHint.find((item) => item !== null && item !== undefined)
    : undefined;
  const sample = mergeValueShapes([value.find((item) => item !== null), hinted]);
  if (Array.isArray(sample)) return `${javaArrayType(sample, sample)}[]`;
  if (typeof sample === "string") return "String[]";
  if (typeof sample === "boolean") return "boolean[]";
  if (typeof sample === "number" && !Number.isInteger(sample)) return "double[]";
  return "int[]";
}

function javaType(value: unknown, typeHint?: unknown): string {
  if (Array.isArray(value)) return javaArrayType(value, typeHint).replace(/\[\]$/, "") + "[]";
  if (typeof value === "string") return "String";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") {
    return Number.isInteger(value) && !(typeof typeHint === "number" && !Number.isInteger(typeHint))
      ? "int"
      : "double";
  }
  return "Object";
}

function cppLiteral(value: unknown): string {
  if (value === null) throw new Error("Null test values are not supported in C++ yet.");
  if (typeof value === "boolean") return String(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return `{${value.map(cppLiteral).join(", ")}}`;
  throw new Error("Unsupported C++ test value.");
}

function cppType(value: unknown, typeHint?: unknown): string {
  if (typeof value === "boolean") return "bool";
  if (typeof value === "string") return "string";
  if (typeof value === "number") {
    return Number.isInteger(value) && !(typeof typeHint === "number" && !Number.isInteger(typeHint))
      ? "int"
      : "double";
  }
  if (Array.isArray(value)) {
    const hinted = Array.isArray(typeHint)
      ? typeHint.find((item) => item !== null && item !== undefined)
      : undefined;
    const sample = value.find((item) => item !== null) ?? hinted;
    return `vector<${sample === undefined ? "int" : cppType(sample, hinted)}>`;
  }
  throw new Error("Unsupported C++ test value.");
}

function mergedArgumentShapes(testCases: CodeTestCase[]): unknown[] {
  const width = testCases.reduce(
    (largest, testCase) => Math.max(largest, testCase.arguments.length),
    0
  );
  return Array.from({ length: width }, (_, index) =>
    mergeValueShapes(testCases.map((testCase) => testCase.arguments[index]))
  );
}

function mergeValueShapes(values: unknown[]): unknown {
  const defined = values.filter((value) => value !== undefined && value !== null);
  if (!defined.length) return undefined;
  if (defined.every(Array.isArray)) {
    const nested = mergeValueShapes(defined.flatMap((value) => value as unknown[]));
    return [nested ?? 0];
  }
  if (defined.every((value) => typeof value === "number")) {
    return defined.some((value) => !Number.isInteger(value as number)) ? 0.5 : 0;
  }
  return defined[0];
}

export function equivalent(
  actual: unknown,
  expected: unknown,
  comparison: "exact" | "unordered" | "unordered-nested" | "unordered-deep" | "one-of" = "exact"
): boolean {
  if (comparison === "one-of" && Array.isArray(expected)) {
    return expected.some((candidate) => JSON.stringify(actual) === JSON.stringify(candidate));
  }
  if (comparison === "unordered" && Array.isArray(actual) && Array.isArray(expected)) {
    return (
      JSON.stringify(actual.map((item) => JSON.stringify(item)).sort()) ===
      JSON.stringify(expected.map((item) => JSON.stringify(item)).sort())
    );
  }
  if (comparison === "unordered-nested" && Array.isArray(actual) && Array.isArray(expected)) {
    return canonicalNested(actual) === canonicalNested(expected);
  }
  if (comparison === "unordered-deep" && Array.isArray(actual) && Array.isArray(expected)) {
    return canonicalDeep(actual) === canonicalDeep(expected);
  }
  return JSON.stringify(actual) === JSON.stringify(expected);
}

/** Sorts the outer list only; the order inside each group is still compared. */
function canonicalNested(value: unknown[]): string {
  return JSON.stringify(value.map((item) => JSON.stringify(item)).sort());
}

/**
 * Sorts both levels, for questions where neither order is part of the answer.
 *
 * Group Anagrams is the case this exists for. Its groups come back in whatever
 * order the hash map yields, and the words inside a group in whatever order the
 * input had them — so the canonical solution, which pushes each word into its
 * group as it is read, produced `[["eat","tea","ate"],…]` against an authored
 * `[["ate","eat","tea"],…]` and was marked wrong under `unordered-nested`.
 *
 * Not a replacement for it: permutations, N-Queens boards and coordinate pairs
 * all carry meaning in the inner order and must keep comparing it.
 */
function canonicalDeep(value: unknown[]): string {
  const canonical = value.map((item) =>
    Array.isArray(item) ? JSON.stringify([...item].map((inner) => JSON.stringify(inner)).sort()) : JSON.stringify(item)
  );
  return JSON.stringify(canonical.sort());
}

function displayValue(value: unknown): string {
  if (typeof value === "string") return value;
  const serialized = JSON.stringify(value);
  return serialized === undefined ? "undefined" : serialized;
}
