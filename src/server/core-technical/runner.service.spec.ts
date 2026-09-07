import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { coreTechnicalStoryReviewArtifactSchema } from "@/lib/practice/core-technical/review-artifact-contracts";
import type { CoreTechnicalSandboxExecutor } from "./runner-contracts";
import {
  CORE_TECHNICAL_NODE_RUNTIME_VERSION,
  CORE_TECHNICAL_OUTPUT_LIMIT_BYTES,
  CORE_TECHNICAL_RUNNER_VERSION
} from "./runner-contracts";
import { CORE_TECHNICAL_RUNNER_REGISTRY, CoreTechnicalRunnerService } from "./runner.service";
import { VercelSandboxNode22Executor } from "./vercel-sandbox-executor";

const generatedDirectory = path.resolve(process.cwd(), "src/lib/practice/core-technical/generated");
const artifacts = [
  "follow-operation-guided-benchmark.json",
  "operation-fails-halfway-standard-benchmark.json"
].map((file) =>
  coreTechnicalStoryReviewArtifactSchema.parse(
    JSON.parse(readFileSync(path.join(generatedDirectory, file), "utf8"))
  )
);
const executableQuestions = artifacts.flatMap((artifact) =>
  artifact.questionBlock.questions.filter((question) => question.runnerContract)
);
const localSandboxAvailable =
  (process.platform === "darwin" && existsSync("/usr/bin/sandbox-exec")) ||
  (process.platform === "linux" && existsSync("/usr/bin/bwrap"));
const isolated = describe.runIf(localSandboxAvailable);

describe("Core Technical runner contracts", () => {
  it("registers only the exact supported runtime and fails closed before execution", async () => {
    expect(CORE_TECHNICAL_RUNNER_REGISTRY).toEqual([
      {
        language: "javascript",
        runtime: "nodejs",
        contractRuntimeVersion: "22",
        runtimeVersion: "22.23.2",
        runnerVersion: CORE_TECHNICAL_RUNNER_VERSION,
        entrypoint: "solution.mjs"
      }
    ]);

    const execute = vi.fn();
    const executor = {
      runtimeVersion: CORE_TECHNICAL_NODE_RUNTIME_VERSION,
      sandboxIdentity: "test-sandbox",
      execute
    } as CoreTechnicalSandboxExecutor;
    const unsupported = structuredClone(executableQuestions[0]!);
    unsupported.runnerContract!.entrypoint = "candidate.mjs";

    await expect(
      new CoreTechnicalRunnerService(executor).run(unsupported, "export {};")
    ).rejects.toThrow("No pinned runner");
    expect(execute).not.toHaveBeenCalled();
  });

  it("uses a fresh network-denied Vercel microVM and verifies its exact runtime", async () => {
    const files = new Map<string, string>();
    const stop = vi.fn().mockResolvedValue(undefined);
    const runCommand = vi.fn(async ({ args }: { args?: string[] }) => {
      if (args?.[0] === "--version") return command("v22.23.2\n");
      const request = JSON.parse(files.get("/vercel/sandbox/core-technical/request.json")!);
      return command(
        `__TRAILGRAD_SANDBOX_SUPERVISOR__${request.nonce}:${JSON.stringify({
          reason: "completed",
          exitCode: 0,
          stdout: "",
          stderr: "",
          durationMs: 12,
          peakMemoryMb: 40
        })}\n`
      );
    });
    const create = vi.fn().mockResolvedValue({
      writeFiles: vi.fn(async (values: Array<{ path: string; content: string }>) => {
        for (const value of values) files.set(value.path, value.content);
      }),
      runCommand,
      stop
    });
    const executor = new VercelSandboxNode22Executor(create);

    const result = await executor.execute({
      mode: "check",
      sourceCode: "export const answer = 42;",
      timeoutMs: 1_000,
      memoryMb: 64,
      outputLimitBytes: 65_536
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        runtime: "node22",
        resources: { vcpus: 1 },
        networkPolicy: "deny-all"
      })
    );
    expect(result).toMatchObject({
      reason: "completed",
      runtimeVersion: "22.23.2",
      sandboxIdentity: "vercel-firecracker-node22-v1"
    });
    expect(files.get("/vercel/sandbox/core-technical/solution.mjs")).toBe(
      "export const answer = 42;"
    );
    expect(stop).toHaveBeenCalledOnce();
  });

  it("stops the remote sandbox and fails closed when its Node patch differs", async () => {
    const stop = vi.fn().mockResolvedValue(undefined);
    const create = vi.fn().mockResolvedValue({
      writeFiles: vi.fn(),
      runCommand: vi.fn().mockResolvedValue(command("v22.22.0\n")),
      stop
    });

    await expect(
      new VercelSandboxNode22Executor(create).execute({
        mode: "check",
        sourceCode: "export {};",
        timeoutMs: 1_000,
        memoryMb: 64,
        outputLimitBytes: 65_536
      })
    ).rejects.toThrow("does not provide pinned Node.js 22.23.2");
    expect(stop).toHaveBeenCalledOnce();
  });
});

isolated("Core Technical pinned local sandbox", () => {
  const runner = new CoreTechnicalRunnerService();

  it("parses starters, rejects them through tests, passes references, and kills every mutant", async () => {
    for (const question of executableQuestions) {
      const audit = await runner.auditQuestion(question);
      expect(audit).toMatchObject({
        valid: true,
        runnerVersion: CORE_TECHNICAL_RUNNER_VERSION,
        runtimeVersion: "22.23.2",
        starter: { compiled: true, rejectedByTests: true },
        reference: { compiled: true, passed: true },
        failures: []
      });
      expect(audit.wrongSolutions.every((mutant) => mutant.rejected)).toBe(true);
      expect(audit.questionFingerprint).toMatch(/^[a-f0-9]{64}$/);
      expect(audit.testSuiteFingerprint).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("returns owned fingerprints and public evidence without revealing hidden assertions", async () => {
    const question = executableQuestions[0]!;
    const result = await runner.run(question, question.referenceSolution!);

    expect(result).toMatchObject({
      accepted: true,
      status: "accepted",
      runnerVersion: CORE_TECHNICAL_RUNNER_VERSION,
      runtimeVersion: "22.23.2",
      hiddenTests: { passed: 1, total: 1 },
      limits: {
        outputBytes: CORE_TECHNICAL_OUTPUT_LIMIT_BYTES,
        filesystem: "read-only-submission",
        processes: 1,
        network: false
      }
    });
    expect(result.codeFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(result.testSuiteFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(result)).not.toContain(question.hiddenTests![0]!.name);
    expect(JSON.stringify(result)).not.toContain(question.hiddenTests![0]!.testCode);
  });

  it("enforces timeout, memory, and combined output ceilings", async () => {
    const question = executableQuestions[0]!;
    const [timedOut, memoryLimited, outputLimited] = await Promise.all([
      runner.run(question, "export function loadConfig() { while (true) {} }"),
      runner.run(
        question,
        "export function loadConfig() { const held = []; while (true) held.push(new Uint8Array(1024 * 1024)); }"
      ),
      runner.run(
        question,
        'console.log("x".repeat(70000)); export function loadConfig() { return { loaded: true }; }'
      )
    ]);

    expect(timedOut.status).toBe("timeout");
    expect(memoryLimited.status).toBe("memory-limit");
    expect(outputLimited.status).toBe("output-limit");
  });

  describe("filesystem, process, and network isolation", () => {
    const server = createServer((_request, response) => response.end("reachable"));
    let port = 0;

    beforeAll(async () => {
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Test server has no TCP port");
      port = address.port;
    });
    afterAll(async () => {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    });

    it("denies host reads/writes, subprocesses, and even loopback access", async () => {
      const question = structuredClone(executableQuestions[0]!);
      question.publicTests = [
        {
          name: "all prohibited capabilities stay unavailable",
          input: "filesystem, process, network probes",
          expected: "all denied",
          testCode:
            "const result = await solution.probe(); return result.read === false && result.write === false && result.process === false && result.network === false;"
        }
      ];
      question.hiddenTests = [
        {
          name: "sandbox remains live after denied calls",
          input: "post-probe",
          expected: "alive",
          testCode: "return (await solution.probe()).alive === true;"
        }
      ];
      const code = `import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
export async function probe() {
  const result = { read: false, write: false, process: false, network: false, alive: true };
  try { readFileSync("/etc/hosts", "utf8"); result.read = true; } catch {}
  try { writeFileSync("/tmp/trailgrad-sandbox-probe", "blocked"); result.write = true; } catch {}
  try { spawnSync("/usr/bin/true"); result.process = true; } catch {}
  try { const response = await fetch("http://127.0.0.1:${port}"); result.network = response.ok; } catch {}
  return result;
}`;

      const result = await runner.run(question, code);
      expect(result.accepted).toBe(true);
      expect(result.publicTests).toEqual([
        expect.objectContaining({ passed: true, expected: "all denied" })
      ]);
      expect(result.hiddenTests).toEqual({ passed: 1, total: 1 });
    });
  });
});

function command(stdout: string, stderr = ""): FinishedCommandFixture {
  return {
    exitCode: 0,
    durationMs: 12,
    stdout: async () => stdout,
    stderr: async () => stderr
  };
}

type FinishedCommandFixture = {
  exitCode: number;
  durationMs: number;
  stdout(): Promise<string>;
  stderr(): Promise<string>;
};
