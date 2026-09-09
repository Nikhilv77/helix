import type {
  GeneratedQuestionCandidate,
  coreTechnicalTestCaseSchema
} from "@/features/practice/core-technical/domain/question-contracts";
import type { z } from "zod";

export const CORE_TECHNICAL_NODE_RUNTIME_VERSION = "22.23.2" as const;
export const CORE_TECHNICAL_RUNNER_VERSION = "core-technical-nodejs-22.23.2-isolated-v1" as const;
export const CORE_TECHNICAL_OUTPUT_LIMIT_BYTES = 64 * 1024;

export type CoreTechnicalTestCase = z.infer<typeof coreTechnicalTestCaseSchema>;
export type ExecutableCoreTechnicalQuestion = GeneratedQuestionCandidate & {
  starterCode: string;
  referenceSolution: string;
  publicTests: CoreTechnicalTestCase[];
  hiddenTests: CoreTechnicalTestCase[];
  wrongSolutions: Array<{ name: string; code: string }>;
  runnerContract: NonNullable<GeneratedQuestionCandidate["runnerContract"]>;
};

export type SandboxLimitReason =
  "completed" | "timeout" | "memory-limit" | "output-limit" | "process-limit" | "execution-error";

export type SandboxExecution = {
  reason: SandboxLimitReason;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  peakMemoryMb: number | null;
  runtimeVersion: typeof CORE_TECHNICAL_NODE_RUNTIME_VERSION;
  sandboxIdentity: string;
};

export type SandboxExecutionRequest = {
  mode: "check" | "test";
  sourceCode: string;
  harnessCode?: string;
  stdin?: string;
  timeoutMs: number;
  memoryMb: number;
  outputLimitBytes: number;
};

/** The only interface allowed to cross from application code into untrusted execution. */
export interface CoreTechnicalSandboxExecutor {
  readonly runtimeVersion: typeof CORE_TECHNICAL_NODE_RUNTIME_VERSION;
  readonly sandboxIdentity: string;
  execute(request: SandboxExecutionRequest): Promise<SandboxExecution>;
}

export type CoreTechnicalVisibleTestResult = {
  name: string;
  input: string;
  expected: string;
  passed: boolean;
  diagnostic?: string;
};

export type CoreTechnicalRunResult = {
  accepted: boolean;
  status:
    | "accepted"
    | "tests-failed"
    | "compile-error"
    | "runtime-error"
    | "timeout"
    | "memory-limit"
    | "output-limit"
    | "process-limit";
  codeFingerprint: string;
  testSuiteFingerprint: string;
  runnerIdentity: string;
  runnerVersion: typeof CORE_TECHNICAL_RUNNER_VERSION;
  runtimeVersion: typeof CORE_TECHNICAL_NODE_RUNTIME_VERSION;
  limits: {
    timeoutMs: number;
    memoryMb: number;
    outputBytes: number;
    filesystem: "read-only-submission";
    processes: 1;
    network: false;
  };
  publicTests: CoreTechnicalVisibleTestResult[];
  hiddenTests: { passed: number; total: number };
  durationMs: number;
  peakMemoryMb: number | null;
  diagnostic?: string;
};

export type CoreTechnicalQuestionRunnerAudit = {
  valid: boolean;
  runnerVersion: typeof CORE_TECHNICAL_RUNNER_VERSION;
  runtimeVersion: typeof CORE_TECHNICAL_NODE_RUNTIME_VERSION;
  runnerIdentity: string;
  questionFingerprint: string;
  testSuiteFingerprint: string;
  starter: { compiled: boolean; rejectedByTests: boolean };
  reference: { compiled: boolean; passed: boolean };
  wrongSolutions: Array<{ name: string; compiled: boolean; rejected: boolean }>;
  failures: string[];
};
