import { randomBytes } from "node:crypto";
import { Sandbox } from "@vercel/sandbox";

import {
  CORE_TECHNICAL_NODE_RUNTIME_VERSION,
  type CoreTechnicalSandboxExecutor,
  type SandboxExecution,
  type SandboxExecutionRequest,
  type SandboxLimitReason
} from "./runner-contracts";

type FinishedCommand = {
  exitCode: number;
  durationMs?: number;
  stdout(): Promise<string>;
  stderr(): Promise<string>;
};

type VercelSandbox = {
  writeFiles(files: Array<{ path: string; content: string; mode?: number }>): Promise<void>;
  runCommand(params: {
    cmd: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
    timeoutMs?: number;
  }): Promise<FinishedCommand>;
  stop(): Promise<unknown>;
};

type CreateVercelSandbox = (params: {
  runtime: "node22";
  timeout: number;
  resources: { vcpus: number };
  networkPolicy: "deny-all";
  env: Record<string, string>;
}) => Promise<VercelSandbox>;

const WORK_DIRECTORY = "/vercel/sandbox/core-technical";
const SUPERVISOR_PREFIX = "__TRAILGRAD_SANDBOX_SUPERVISOR__";

/** Production executor: every request gets a separate, network-denied Firecracker VM. */
export class VercelSandboxNode22Executor implements CoreTechnicalSandboxExecutor {
  readonly runtimeVersion = CORE_TECHNICAL_NODE_RUNTIME_VERSION;
  readonly sandboxIdentity = "vercel-firecracker-node22-v1";

  constructor(
    private readonly createSandbox: CreateVercelSandbox = (params) =>
      Sandbox.create(params) as Promise<VercelSandbox>
  ) {}

  async execute(request: SandboxExecutionRequest): Promise<SandboxExecution> {
    const nonce = randomBytes(24).toString("hex");
    const sandbox = await this.createSandbox({
      runtime: "node22",
      timeout: Math.max(10_000, request.timeoutMs + 5_000),
      resources: { vcpus: 1 },
      networkPolicy: "deny-all",
      env: { NODE_ENV: "production", LANG: "C", LC_ALL: "C", TZ: "UTC" }
    });

    try {
      await sandbox.writeFiles([
        { path: `${WORK_DIRECTORY}/solution.mjs`, content: request.sourceCode, mode: 0o400 },
        ...(request.mode === "test"
          ? [
              {
                path: `${WORK_DIRECTORY}/harness.mjs`,
                content: request.harnessCode ?? "",
                mode: 0o400
              }
            ]
          : []),
        {
          path: `${WORK_DIRECTORY}/request.json`,
          content: JSON.stringify({
            nonce,
            mode: request.mode,
            stdin: request.stdin ?? "",
            timeoutMs: request.timeoutMs,
            memoryMb: request.memoryMb,
            outputLimitBytes: request.outputLimitBytes
          }),
          mode: 0o400
        },
        {
          path: `${WORK_DIRECTORY}/supervisor.mjs`,
          content: supervisorSource(),
          mode: 0o500
        }
      ]);

      const identity = await sandbox.runCommand({
        cmd: "node",
        args: ["--version"],
        cwd: WORK_DIRECTORY,
        timeoutMs: 1_000
      });
      if (
        identity.exitCode !== 0 ||
        (await identity.stdout()).trim() !== `v${CORE_TECHNICAL_NODE_RUNTIME_VERSION}`
      ) {
        throw new Error(
          `Vercel Sandbox does not provide pinned Node.js ${CORE_TECHNICAL_NODE_RUNTIME_VERSION}`
        );
      }

      const command = await sandbox.runCommand({
        cmd: "node",
        args: [`${WORK_DIRECTORY}/supervisor.mjs`, `${WORK_DIRECTORY}/request.json`],
        cwd: WORK_DIRECTORY,
        env: {
          NODE_ENV: "production",
          LANG: "C",
          LC_ALL: "C",
          TZ: "UTC",
          NODE_NO_WARNINGS: "1"
        },
        timeoutMs: request.timeoutMs + 1_000
      });
      const [stdout, stderr] = await Promise.all([command.stdout(), command.stderr()]);
      const envelope = parseSupervisorEnvelope(stdout, nonce);
      if (!envelope) {
        return {
          reason: command.exitCode === 0 ? "execution-error" : "timeout",
          exitCode: command.exitCode,
          signal: null,
          stdout: "",
          stderr: stderr.slice(0, request.outputLimitBytes),
          durationMs: command.durationMs ?? request.timeoutMs,
          peakMemoryMb: null,
          runtimeVersion: this.runtimeVersion,
          sandboxIdentity: this.sandboxIdentity
        };
      }
      return {
        ...envelope,
        signal: null,
        runtimeVersion: this.runtimeVersion,
        sandboxIdentity: this.sandboxIdentity
      };
    } finally {
      await sandbox.stop().catch(() => undefined);
    }
  }
}

function parseSupervisorEnvelope(
  output: string,
  nonce: string
): Omit<SandboxExecution, "signal" | "runtimeVersion" | "sandboxIdentity"> | null {
  const prefix = `${SUPERVISOR_PREFIX}${nonce}:`;
  const line = output
    .split(/\r?\n/)
    .reverse()
    .find((candidate) => candidate.startsWith(prefix));
  if (!line) return null;
  try {
    const value = JSON.parse(line.slice(prefix.length)) as Record<string, unknown>;
    const reasons: SandboxLimitReason[] = [
      "completed",
      "timeout",
      "memory-limit",
      "output-limit",
      "process-limit",
      "execution-error"
    ];
    if (
      !reasons.includes(value.reason as SandboxLimitReason) ||
      !(typeof value.exitCode === "number" || value.exitCode === null) ||
      typeof value.stdout !== "string" ||
      typeof value.stderr !== "string" ||
      typeof value.durationMs !== "number" ||
      !(typeof value.peakMemoryMb === "number" || value.peakMemoryMb === null)
    ) {
      return null;
    }
    return value as Omit<SandboxExecution, "signal" | "runtimeVersion" | "sandboxIdentity">;
  } catch {
    return null;
  }
}

function supervisorSource(): string {
  return `import { spawn } from "node:child_process";
import { readFile, unlink } from "node:fs/promises";
const request = JSON.parse(await readFile(process.argv[2], "utf8"));
await unlink(process.argv[2]);
const startedAt = performance.now();
const entrypoint = request.mode === "check" ? "solution.mjs" : "harness.mjs";
const args = ["--permission", "--allow-fs-read=solution.mjs", "--max-old-space-size=" + request.memoryMb, ...(request.mode === "check" ? ["--check"] : []), entrypoint];
const child = spawn(process.execPath, args, { cwd: ${JSON.stringify(WORK_DIRECTORY)}, detached: true, env: { NODE_ENV: "production", LANG: "C", LC_ALL: "C", TZ: "UTC", NODE_NO_WARNINGS: "1" }, stdio: ["pipe", "pipe", "pipe"] });
let stdout = Buffer.alloc(0); let stderr = Buffer.alloc(0); let reason = "completed"; let peakMemoryMb = null;
const kill = () => { try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); } };
const limited = (next) => { if (reason === "completed") reason = next; kill(); };
const collect = (current, chunk) => { const remaining = request.outputLimitBytes - stdout.length - stderr.length; if (remaining <= 0) { limited("output-limit"); return current; } const accepted = chunk.subarray(0, remaining); if (accepted.length < chunk.length) limited("output-limit"); return Buffer.concat([current, accepted]); };
child.stdout.on("data", (chunk) => { stdout = collect(stdout, chunk); }); child.stderr.on("data", (chunk) => { stderr = collect(stderr, chunk); }); child.stdin.end(request.stdin);
const timeout = setTimeout(() => limited("timeout"), request.timeoutMs);
const monitor = setInterval(async () => { try { const status = await readFile("/proc/" + child.pid + "/status", "utf8"); const match = /^VmRSS:\\s+(\\d+)/m.exec(status); const memory = match ? Number(match[1]) / 1024 : 0; peakMemoryMb = Math.max(peakMemoryMb ?? 0, memory); if (memory > request.memoryMb) limited("memory-limit"); const tasks = await readFile("/proc/" + child.pid + "/status", "utf8"); const threads = Number(/^Threads:\\s+(\\d+)/m.exec(tasks)?.[1] ?? 1); if (threads > 16) limited("process-limit"); } catch {} }, 20);
child.once("error", (error) => { clearTimeout(timeout); clearInterval(monitor); finish(null, String(error)); });
child.once("close", (exitCode) => { clearTimeout(timeout); clearInterval(monitor); finish(exitCode, ""); });
let finished = false;
function finish(exitCode, launchError) { if (finished) return; finished = true; if (reason === "completed" && (exitCode !== 0 || launchError)) reason = "execution-error"; const value = { reason, exitCode, stdout: stdout.toString("utf8"), stderr: (stderr.toString("utf8") + launchError), durationMs: Math.ceil(performance.now() - startedAt), peakMemoryMb }; process.stdout.write(${JSON.stringify(SUPERVISOR_PREFIX)} + request.nonce + ":" + JSON.stringify(value) + "\\n"); }`;
}
