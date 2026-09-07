import { createHash, randomBytes } from "node:crypto";

import {
  generatedQuestionCandidateSchema,
  type GeneratedQuestionCandidate
} from "@/lib/practice/core-technical/question-contracts";
import { codeFingerprint } from "@/server/interview/code-fingerprint";

import {
  CORE_TECHNICAL_NODE_RUNTIME_VERSION,
  CORE_TECHNICAL_OUTPUT_LIMIT_BYTES,
  CORE_TECHNICAL_RUNNER_VERSION,
  type CoreTechnicalQuestionRunnerAudit,
  type CoreTechnicalRunResult,
  type CoreTechnicalSandboxExecutor,
  type CoreTechnicalTestCase,
  type ExecutableCoreTechnicalQuestion,
  type SandboxExecution
} from "./runner-contracts";
import { LocalIsolatedNode22Executor } from "./sandbox-process";

const RESULT_PREFIX = "__TRAILGRAD_CORE_TECHNICAL_RESULT__";

export const CORE_TECHNICAL_RUNNER_REGISTRY = Object.freeze([
  Object.freeze({
    language: "javascript" as const,
    runtime: "nodejs" as const,
    contractRuntimeVersion: "22" as const,
    runtimeVersion: CORE_TECHNICAL_NODE_RUNTIME_VERSION,
    runnerVersion: CORE_TECHNICAL_RUNNER_VERSION,
    entrypoint: "solution.mjs" as const
  })
]);

type InternalTestResult = { index: number; passed: boolean; diagnostic?: string };

/**
 * Pinned runner boundary for Core Technical code. It never evaluates source in
 * the application process; all candidate, reference, and generated test code
 * crosses the injected OS-sandbox interface.
 */
export class CoreTechnicalRunnerService {
  constructor(
    private readonly executor: CoreTechnicalSandboxExecutor = new LocalIsolatedNode22Executor()
  ) {}

  supportsStack(input: {
    language: string;
    runtime: string;
    runtimeVersion: string;
  }): boolean {
    return CORE_TECHNICAL_RUNNER_REGISTRY.some(
      (runner) =>
        runner.language === input.language &&
        runner.runtime === input.runtime &&
        runner.runtimeVersion === CORE_TECHNICAL_NODE_RUNTIME_VERSION &&
        input.runtimeVersion === "22 LTS" &&
        this.executor.runtimeVersion === runner.runtimeVersion
    );
  }

  async run(rawQuestion: unknown, code: string): Promise<CoreTechnicalRunResult> {
    const question = executableQuestion(rawQuestion);
    this.assertSupported(question);
    if (code.length < 1 || code.length > 12_000) {
      throw new Error("Core Technical code must contain between 1 and 12000 characters");
    }

    const fingerprint = codeFingerprint(code);
    const suiteFingerprint = fingerprintValue({
      publicTests: question.publicTests,
      hiddenTests: question.hiddenTests
    });
    const compile = await this.execute(question, code, "check");
    if (compile.reason !== "completed") {
      return this.executionFailure(question, fingerprint, suiteFingerprint, compile, true);
    }

    const tests = [...question.publicTests, ...question.hiddenTests];
    const nonce = randomBytes(24).toString("hex");
    const execution = await this.executor.execute({
      mode: "test",
      sourceCode: code,
      harnessCode: testHarness(),
      stdin: JSON.stringify({ nonce, tests: tests.map((test) => ({ testCode: test.testCode })) }),
      timeoutMs: question.runnerContract.timeoutMs,
      memoryMb: question.runnerContract.memoryMb,
      outputLimitBytes: CORE_TECHNICAL_OUTPUT_LIMIT_BYTES
    });
    if (execution.reason !== "completed") {
      return this.executionFailure(question, fingerprint, suiteFingerprint, execution, false);
    }

    const parsed = parseResults(execution.stdout, nonce, tests.length);
    if (!parsed) {
      return this.baseResult(question, fingerprint, suiteFingerprint, execution, {
        accepted: false,
        status: "runtime-error",
        publicTests: question.publicTests.map((test) => visibleResult(test, false)),
        hiddenTests: { passed: 0, total: question.hiddenTests.length },
        diagnostic: boundedDiagnostic(execution.stderr || "The sandbox returned no valid result.")
      });
    }

    const publicResults = question.publicTests.map((test, index) => {
      const result = parsed[index]!;
      return visibleResult(test, result.passed, result.diagnostic);
    });
    const hiddenResults = parsed.slice(question.publicTests.length);
    const accepted = parsed.every((result) => result.passed);
    return this.baseResult(question, fingerprint, suiteFingerprint, execution, {
      accepted,
      status: accepted ? "accepted" : "tests-failed",
      publicTests: publicResults,
      hiddenTests: {
        passed: hiddenResults.filter((result) => result.passed).length,
        total: hiddenResults.length
      }
    });
  }

  async auditQuestion(rawQuestion: unknown): Promise<CoreTechnicalQuestionRunnerAudit> {
    const question = executableQuestion(rawQuestion);
    this.assertSupported(question);
    const failures: string[] = [];
    const starterCompile = await this.execute(question, question.starterCode, "check");
    const starterRun =
      starterCompile.reason === "completed" ? await this.run(question, question.starterCode) : null;
    const referenceCompile = await this.execute(question, question.referenceSolution, "check");
    const referenceRun =
      referenceCompile.reason === "completed"
        ? await this.run(question, question.referenceSolution)
        : null;

    if (starterCompile.reason !== "completed") failures.push("Starter code does not parse");
    if (starterRun?.status !== "tests-failed") {
      failures.push("Starter code does not fail through the authored test assertions");
    }
    if (referenceCompile.reason !== "completed") failures.push("Reference solution does not parse");
    if (!referenceRun?.accepted) failures.push("Reference solution does not pass every test");

    const wrongSolutions: CoreTechnicalQuestionRunnerAudit["wrongSolutions"] = [];
    for (const wrongSolution of question.wrongSolutions) {
      const compile = await this.execute(question, wrongSolution.code, "check");
      const compiled = compile.reason === "completed";
      const result = compiled ? await this.run(question, wrongSolution.code) : null;
      const rejected = result?.status === "tests-failed";
      wrongSolutions.push({ name: wrongSolution.name, compiled, rejected });
      if (!compiled) failures.push(`Wrong-solution mutant does not parse: ${wrongSolution.name}`);
      else if (!rejected) failures.push(`Tests accepted wrong solution: ${wrongSolution.name}`);
    }

    return {
      valid: failures.length === 0,
      runnerVersion: CORE_TECHNICAL_RUNNER_VERSION,
      runtimeVersion: CORE_TECHNICAL_NODE_RUNTIME_VERSION,
      runnerIdentity: this.executor.sandboxIdentity,
      questionFingerprint: fingerprintValue(question),
      testSuiteFingerprint: fingerprintValue({
        publicTests: question.publicTests,
        hiddenTests: question.hiddenTests
      }),
      starter: {
        compiled: starterCompile.reason === "completed",
        rejectedByTests: starterRun?.status === "tests-failed"
      },
      reference: {
        compiled: referenceCompile.reason === "completed",
        passed: referenceRun?.accepted === true
      },
      wrongSolutions,
      failures
    };
  }

  private assertSupported(question: ExecutableCoreTechnicalQuestion): void {
    const runner = CORE_TECHNICAL_RUNNER_REGISTRY.find(
      (candidate) =>
        candidate.language === question.runnerContract.language &&
        candidate.runtime === question.runnerContract.runtime &&
        candidate.contractRuntimeVersion === question.runnerContract.runtimeVersion &&
        candidate.entrypoint === question.runnerContract.entrypoint
    );
    if (!runner) throw new Error("No pinned runner matches this executable contract");
    if (this.executor.runtimeVersion !== runner.runtimeVersion) {
      throw new Error("The sandbox runtime does not match the pinned runner registry");
    }
  }

  private execute(
    question: ExecutableCoreTechnicalQuestion,
    sourceCode: string,
    mode: "check"
  ): Promise<SandboxExecution> {
    return this.executor.execute({
      mode,
      sourceCode,
      timeoutMs: question.runnerContract.timeoutMs,
      memoryMb: question.runnerContract.memoryMb,
      outputLimitBytes: CORE_TECHNICAL_OUTPUT_LIMIT_BYTES
    });
  }

  private executionFailure(
    question: ExecutableCoreTechnicalQuestion,
    fingerprint: string,
    suiteFingerprint: string,
    execution: SandboxExecution,
    compiling: boolean
  ): CoreTechnicalRunResult {
    const status =
      execution.reason === "timeout"
        ? "timeout"
        : execution.reason === "memory-limit"
          ? "memory-limit"
          : execution.reason === "output-limit"
            ? "output-limit"
            : execution.reason === "process-limit"
              ? "process-limit"
              : compiling
                ? "compile-error"
                : "runtime-error";
    return this.baseResult(question, fingerprint, suiteFingerprint, execution, {
      accepted: false,
      status,
      publicTests: question.publicTests.map((test) => visibleResult(test, false)),
      hiddenTests: { passed: 0, total: question.hiddenTests.length },
      diagnostic: boundedDiagnostic(execution.stderr || `Execution stopped: ${execution.reason}`)
    });
  }

  private baseResult(
    question: ExecutableCoreTechnicalQuestion,
    fingerprint: string,
    suiteFingerprint: string,
    execution: SandboxExecution,
    result: Pick<
      CoreTechnicalRunResult,
      "accepted" | "status" | "publicTests" | "hiddenTests" | "diagnostic"
    >
  ): CoreTechnicalRunResult {
    return {
      ...result,
      codeFingerprint: fingerprint,
      testSuiteFingerprint: suiteFingerprint,
      runnerIdentity: execution.sandboxIdentity,
      runnerVersion: CORE_TECHNICAL_RUNNER_VERSION,
      runtimeVersion: execution.runtimeVersion,
      limits: {
        timeoutMs: question.runnerContract.timeoutMs,
        memoryMb: question.runnerContract.memoryMb,
        outputBytes: CORE_TECHNICAL_OUTPUT_LIMIT_BYTES,
        filesystem: "read-only-submission",
        processes: 1,
        network: false
      },
      durationMs: execution.durationMs,
      peakMemoryMb: execution.peakMemoryMb
    };
  }
}

function executableQuestion(rawQuestion: unknown): ExecutableCoreTechnicalQuestion {
  const question = generatedQuestionCandidateSchema.parse(rawQuestion);
  if (
    !question.starterCode ||
    !question.referenceSolution ||
    !question.publicTests ||
    !question.hiddenTests ||
    !question.wrongSolutions ||
    !question.runnerContract
  ) {
    throw new Error("This Core Technical question is not executable");
  }
  return question as ExecutableCoreTechnicalQuestion;
}

function testHarness(): string {
  return `const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
const write = process.stdout.write.bind(process.stdout);
const stringify = JSON.stringify.bind(JSON);
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const results = [];
const pushResult = Array.prototype.push.bind(results);
let solution;
try {
  solution = await import("./solution.mjs");
} catch (error) {
  write(${JSON.stringify(RESULT_PREFIX)} + payload.nonce + ":" + stringify({ importError: String(error?.message ?? error) }) + "\\n");
  process.exit(0);
}
for (let index = 0; index < payload.tests.length; index += 1) {
  try {
    const assertion = new AsyncFunction("solution", '"use strict";\\n' + payload.tests[index].testCode);
    const passed = (await assertion(solution)) === true;
    pushResult({ index, passed, ...(passed ? {} : { diagnostic: "Assertion returned false." }) });
  } catch (error) {
    pushResult({ index, passed: false, diagnostic: String(error?.name ?? "Error") + ": " + String(error?.message ?? error).slice(0, 240) });
  }
}
write(${JSON.stringify(RESULT_PREFIX)} + payload.nonce + ":" + stringify({ results }) + "\\n");`;
}

function parseResults(
  stdout: string,
  nonce: string,
  expectedCount: number
): InternalTestResult[] | null {
  const prefix = `${RESULT_PREFIX}${nonce}:`;
  const line = stdout
    .split(/\r?\n/)
    .reverse()
    .find((candidate) => candidate.startsWith(prefix));
  if (!line) return null;
  try {
    const payload = JSON.parse(line.slice(prefix.length)) as { results?: InternalTestResult[] };
    if (
      !Array.isArray(payload.results) ||
      payload.results.length !== expectedCount ||
      payload.results.some(
        (result, index) =>
          result.index !== index ||
          typeof result.passed !== "boolean" ||
          (result.diagnostic !== undefined && typeof result.diagnostic !== "string")
      )
    ) {
      return null;
    }
    return payload.results.map((result) => ({
      index: result.index,
      passed: result.passed,
      ...(result.diagnostic ? { diagnostic: boundedDiagnostic(result.diagnostic) } : {})
    }));
  } catch {
    return null;
  }
}

function visibleResult(
  test: CoreTechnicalTestCase,
  passed: boolean,
  diagnostic?: string
): CoreTechnicalRunResult["publicTests"][number] {
  return {
    name: test.name,
    input: test.input,
    expected: test.expected,
    passed,
    ...(diagnostic ? { diagnostic: boundedDiagnostic(diagnostic) } : {})
  };
}

function boundedDiagnostic(value: string): string {
  return value.replaceAll(/[/\\][^\s:]+/g, "<sandbox-path>").slice(0, 500);
}

function fingerprintValue(value: unknown): string {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function isExecutableCoreTechnicalQuestion(
  question: GeneratedQuestionCandidate
): question is ExecutableCoreTechnicalQuestion {
  return Boolean(
    question.starterCode &&
    question.referenceSolution &&
    question.publicTests?.length &&
    question.hiddenTests?.length &&
    question.wrongSolutions?.length &&
    question.runnerContract
  );
}
