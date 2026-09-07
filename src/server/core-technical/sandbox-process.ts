import { spawn } from "node:child_process";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  CORE_TECHNICAL_NODE_RUNTIME_VERSION,
  type CoreTechnicalSandboxExecutor,
  type SandboxExecution,
  type SandboxExecutionRequest,
  type SandboxLimitReason
} from "./runner-contracts";

type SpawnPlan = { command: string; args: string[] };

/**
 * OS-level executor. Application/request code never imports process APIs or
 * evaluates candidate source; it can only call the narrow sandbox interface.
 */
export class LocalIsolatedNode22Executor implements CoreTechnicalSandboxExecutor {
  readonly runtimeVersion = CORE_TECHNICAL_NODE_RUNTIME_VERSION;
  readonly sandboxIdentity: string;
  private runtimeVerified: Promise<void> | null = null;

  constructor(
    private readonly nodeBinary = path.resolve(process.cwd(), "node_modules/node/bin/node"),
    private readonly platform = process.platform
  ) {
    this.sandboxIdentity = platform === "darwin" ? "macos-seatbelt-v1" : "linux-bubblewrap-v1";
  }

  async execute(request: SandboxExecutionRequest): Promise<SandboxExecution> {
    await (this.runtimeVerified ??= this.verifyRuntime());
    const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "trailgrad-core-technical-"));
    const workDirectory = await realpath(temporaryDirectory);
    try {
      const solutionPath = path.join(workDirectory, "solution.mjs");
      const harnessPath = path.join(workDirectory, "harness.mjs");
      await writeFile(solutionPath, request.sourceCode, { encoding: "utf8", mode: 0o400 });
      if (request.mode === "test") {
        if (!request.harnessCode) throw new Error("A sandbox test run requires a harness");
        await writeFile(harnessPath, request.harnessCode, { encoding: "utf8", mode: 0o400 });
      }

      const plan = await this.buildSpawnPlan(request, workDirectory, solutionPath, harnessPath);
      return await runBoundedProcess(plan, request, this.runtimeVersion, this.sandboxIdentity);
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }

  private async verifyRuntime(): Promise<void> {
    const binary = await realpath(this.nodeBinary);
    const result = await runBoundedProcess(
      { command: binary, args: ["--version"] },
      {
        mode: "check",
        sourceCode: "",
        timeoutMs: 1_000,
        memoryMb: 128,
        outputLimitBytes: 1_024
      },
      this.runtimeVersion,
      "runtime-identity-check"
    );
    if (result.reason !== "completed" || result.stdout.trim() !== `v${this.runtimeVersion}`) {
      throw new Error(`Pinned Node.js ${this.runtimeVersion} runtime is unavailable`);
    }
  }

  private async buildSpawnPlan(
    request: SandboxExecutionRequest,
    workDirectory: string,
    solutionPath: string,
    harnessPath: string
  ): Promise<SpawnPlan> {
    const nodeBinary = await realpath(this.nodeBinary);
    const nodeArgs = [
      "--permission",
      `--allow-fs-read=${solutionPath}`,
      `--max-old-space-size=${request.memoryMb}`,
      request.mode === "check" ? "--check" : harnessPath
    ];
    if (request.mode === "check") nodeArgs.push(solutionPath);

    if (this.platform === "darwin") {
      return {
        command: "/usr/bin/sandbox-exec",
        args: ["-p", macOsProfile(nodeBinary, workDirectory), nodeBinary, ...nodeArgs]
      };
    }
    if (this.platform === "linux") {
      return {
        command: "/usr/bin/bwrap",
        args: [
          "--unshare-all",
          "--die-with-parent",
          "--new-session",
          "--clearenv",
          "--cap-drop",
          "ALL",
          "--ro-bind",
          nodeBinary,
          "/runner/node",
          "--ro-bind",
          workDirectory,
          "/workspace",
          "--ro-bind",
          "/usr/lib",
          "/usr/lib",
          "--ro-bind-try",
          "/lib",
          "/lib",
          "--ro-bind-try",
          "/lib64",
          "/lib64",
          "--proc",
          "/proc",
          "--dev",
          "/dev",
          "--chdir",
          "/workspace",
          "/runner/node",
          "--permission",
          "--allow-fs-read=/workspace/solution.mjs",
          `--max-old-space-size=${request.memoryMb}`,
          ...(request.mode === "check"
            ? ["--check", "/workspace/solution.mjs"]
            : ["/workspace/harness.mjs"])
        ]
      };
    }
    throw new Error(`No Core Technical sandbox is configured for ${this.platform}`);
  }
}

function macOsProfile(nodeBinary: string, workDirectory: string): string {
  const literal = (value: string) => JSON.stringify(value);
  return [
    "(version 1)",
    "(allow default)",
    "(deny network*)",
    "(deny process-fork)",
    "(deny process-exec)",
    `(allow process-exec (literal ${literal(nodeBinary)}))`,
    '(deny file-read-data (subpath "/Users") (subpath "/Volumes") (subpath "/private"))',
    `(allow file-read-data (literal ${literal(nodeBinary)}) (subpath ${literal(workDirectory)}))`,
    "(deny file-write*)",
    '(allow file-write* (literal "/dev/null"))'
  ].join("\n");
}

async function runBoundedProcess(
  plan: SpawnPlan,
  request: SandboxExecutionRequest,
  runtimeVersion: typeof CORE_TECHNICAL_NODE_RUNTIME_VERSION,
  sandboxIdentity: string
): Promise<SandboxExecution> {
  const startedAt = performance.now();
  return new Promise((resolve, reject) => {
    const sandboxEnvironment: NodeJS.ProcessEnv = {
      NODE_ENV: "production",
      LANG: "C",
      LC_ALL: "C",
      TZ: "UTC",
      NODE_NO_WARNINGS: "1"
    };
    const child = spawn(plan.command, plan.args, {
      cwd: tmpdir(),
      detached: true,
      env: sandboxEnvironment,
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    let stderr: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    let reason: SandboxLimitReason = "completed";
    let peakMemoryMb: number | null = null;
    let settled = false;

    const killGroup = () => {
      if (child.pid) {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          child.kill("SIGKILL");
        }
      }
    };
    const failForLimit = (nextReason: SandboxLimitReason) => {
      if (reason === "completed") reason = nextReason;
      killGroup();
    };
    const collect = (current: Buffer, chunk: Buffer) => {
      const remaining = request.outputLimitBytes - stdout.length - stderr.length;
      if (remaining <= 0) {
        failForLimit("output-limit");
        return current;
      }
      const accepted = chunk.subarray(0, remaining);
      if (accepted.length < chunk.length) failForLimit("output-limit");
      return Buffer.concat([current, accepted]);
    };
    child.stdout.on("data", (chunk: Buffer) => {
      stdout = collect(stdout, chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = collect(stderr, chunk);
    });
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearInterval(memoryMonitor);
      reject(new Error(`Sandbox process could not start: ${error.message}`));
    });
    child.once("close", (exitCode, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearInterval(memoryMonitor);
      resolve({
        reason: reason === "completed" && exitCode !== 0 ? "execution-error" : reason,
        exitCode,
        signal,
        stdout: stdout.toString("utf8"),
        stderr: stderr.toString("utf8"),
        durationMs: Math.ceil(performance.now() - startedAt),
        peakMemoryMb,
        runtimeVersion,
        sandboxIdentity
      });
    });

    child.stdin.end(request.stdin ?? "");
    const timeout = setTimeout(() => failForLimit("timeout"), request.timeoutMs);
    const memoryMonitor = setInterval(() => {
      if (!child.pid || reason !== "completed") return;
      const monitor = spawn("/bin/ps", ["-o", "rss=", "-g", String(child.pid)], {
        env: { NODE_ENV: "production", LANG: "C" },
        stdio: ["ignore", "pipe", "ignore"]
      });
      let output = "";
      monitor.stdout.on("data", (chunk: Buffer) => {
        output += chunk.toString("utf8");
      });
      monitor.once("close", () => {
        const residentSets = output
          .trim()
          .split(/\s+/)
          .map((value) => Number.parseInt(value, 10))
          .filter(Number.isFinite);
        const allowedProcesses = sandboxIdentity === "linux-bubblewrap-v1" ? 2 : 1;
        if (residentSets.length > allowedProcesses) {
          failForLimit("process-limit");
          return;
        }
        const kilobytes = residentSets.reduce((sum, value) => sum + value, 0);
        if (kilobytes === 0) return;
        const megabytes = kilobytes / 1024;
        peakMemoryMb = Math.max(peakMemoryMb ?? 0, megabytes);
        if (megabytes > request.memoryMb) failForLimit("memory-limit");
      });
    }, 25);
  });
}
