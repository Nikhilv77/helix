import { auth } from "@clerk/nextjs/server";
import { after } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import ts from "typescript";
import { findQuestion } from "@/features/practice/dsa/domain/dsa";
import { dsaFunctionName } from "@/features/practice/dsa/domain/dsa-code-templates";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { getAppContainer } from "@/server/app-container";
import { authenticatedOwnerId } from "@/features/interviews/server/owner";
import { codeFingerprint } from "@/features/interviews/server/code-fingerprint";
import {
  buildTestCases,
  buildTestHarness,
  parseTestResults,
  resultMarker
} from "@/features/practice/dsa/server/code-test-harness";
import { getSharedGuard, RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";

export const dynamic = "force-dynamic";

const runSchema = z
  .object({
    /** Required for standalone practice runs so evidence writes are idempotent. */
    requestId: z.string().uuid().optional(),
    code: z.string().trim().min(1).max(20_000),
    language: z.enum(["python", "javascript", "typescript", "cpp", "java"]),
    /**
     * A DSA question to check the code against. Omitted by rounds whose task is
     * written for the candidate rather than drawn from the bank, which run the
     * code as-is and report its output.
     */
    slug: z.string().trim().min(1).max(140).optional(),
    stdin: z.string().max(10_000).default(""),
    sessionId: z.string().uuid().optional(),
    questionIndex: z.number().int().nonnegative().optional()
  })
  .superRefine((value, context) => {
    if ((value.sessionId === undefined) !== (value.questionIndex === undefined)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sessionId"],
        message: "sessionId and questionIndex must be supplied together"
      });
    }
    if (value.slug && value.sessionId === undefined && value.requestId === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["requestId"],
        message: "requestId is required for standalone DSA runs"
      });
    }
  });

// Node 20 supports the syntax taught by the current editor, and GCC 14
// supports the C++17 optional values used by the tree harness. Python is
// resolved from this Judge0 host so it cannot silently fall back to 3.8.
const languages: Record<
  Exclude<z.infer<typeof runSchema>["language"], "python">,
  { id: number; name: string }
> = {
  cpp: { id: 105, name: "C++ (GCC 14.1.0)" },
  java: { id: 62, name: "Java (OpenJDK 13.0.1)" },
  javascript: { id: 97, name: "JavaScript (Node.js 20.17.0)" },
  typescript: { id: 97, name: "TypeScript (Node.js 20.17.0)" }
};

const judgeLanguagesSchema = z.array(
  z.object({ id: z.number().int().positive(), name: z.string() })
);
let pythonLanguageCache: {
  url: string;
  expiresAt: number;
  language: { id: number; name: string };
} | null = null;

async function modernPythonLanguage(
  url: string,
  headers: Record<string, string>
): Promise<{ id: number; name: string }> {
  if (pythonLanguageCache?.url === url && pythonLanguageCache.expiresAt > Date.now()) {
    return pythonLanguageCache.language;
  }
  let response: Response;
  try {
    response = await fetch(`${url}/languages`, {
      headers,
      signal: AbortSignal.timeout(5_000)
    });
  } catch {
    throw new ApiRouteError(
      503,
      "PYTHON_RUNTIME_UNAVAILABLE",
      "Could not check the Python runtime."
    );
  }
  const parsed = judgeLanguagesSchema.safeParse(await response.json().catch(() => null));
  if (!response.ok || !parsed.success) {
    throw new ApiRouteError(
      503,
      "PYTHON_RUNTIME_UNAVAILABLE",
      "Could not check the Python runtime."
    );
  }
  const modern = parsed.data
    .map((language) => ({
      language,
      version: language.name.match(/^Python \(3\.(\d+)\.(\d+)\)/)
    }))
    .filter((entry) => entry.version && Number(entry.version[1]) >= 10)
    .sort(
      (left, right) =>
        Number(right.version![1]) - Number(left.version![1]) ||
        Number(right.version![2]) - Number(left.version![2])
    )[0]?.language;
  if (!modern) {
    throw new ApiRouteError(
      503,
      "PYTHON_RUNTIME_UNAVAILABLE",
      "This code runner has no supported Python 3.10 or newer runtime."
    );
  }
  pythonLanguageCache = { url, expiresAt: Date.now() + 60 * 60 * 1_000, language: modern };
  return modern;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");

    const parsed = runSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiRouteError(400, "CODE_INPUT_INVALID", "Code input is invalid", {
        messages: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      });
    }

    const app = getAppContainer();
    const config = app.config;
    const ownerId = authenticatedOwnerId(userId);
    let slug = parsed.data.slug;
    let testCases: ReturnType<typeof buildTestCases> = [];
    let sourceCode = parsed.data.code;
    const runnerLanguage =
      parsed.data.language === "typescript" ? ("javascript" as const) : parsed.data.language;

    // A block assessment is pinned to the immutable assessment record. The
    // browser's slug is ignored entirely for these sessions, so an old tab or
    // crafted request cannot execute a changed/live-bank question instead.
    const dsaFrozenTransfer =
      parsed.data.sessionId !== undefined && parsed.data.questionIndex !== undefined
        ? await app.dsaBlockAssessmentRuntimeService.frozenTransferForRun(
            ownerId,
            parsed.data.sessionId,
            parsed.data.questionIndex
          )
        : null;
    const coreFrozenTransfer =
      !dsaFrozenTransfer &&
      parsed.data.sessionId !== undefined &&
      parsed.data.questionIndex !== undefined
        ? await app.coreTechnicalAssessmentRuntimeService.frozenTransferForRun(
            ownerId,
            parsed.data.sessionId,
            parsed.data.questionIndex
          )
        : null;

    if (coreFrozenTransfer) {
      if (parsed.data.language !== "javascript") {
        throw new ApiRouteError(
          422,
          "CORE_TECHNICAL_LANGUAGE_UNSUPPORTED",
          "This Node.js assessment must be completed in JavaScript."
        );
      }
      if (parsed.data.code.length > 12_000) {
        throw new ApiRouteError(
          400,
          "CORE_TECHNICAL_CODE_TOO_LONG",
          "Core Technical solutions must be at most 12000 characters."
        );
      }
      const guard = getSharedGuard(config);
      await guard.enforce(RATE_LIMIT_POLICIES.codeExecution, ownerId);
      const lease = await guard.acquire(
        {
          namespace: "code-run",
          ttlMs: 25_000,
          code: "CODE_RUN_IN_PROGRESS",
          message: "Your previous code run is still in progress."
        },
        ownerId
      );
      try {
        const result = await app.coreTechnicalRunnerService.run(
          coreFrozenTransfer.question,
          parsed.data.code
        );
        const hiddenTests = Array.from({ length: result.hiddenTests.total }, (_, index) => ({
          index: result.publicTests.length + index,
          visible: false,
          input: "",
          expectedOutput: "",
          actualOutput: "",
          passed: index < result.hiddenTests.passed,
          error: null
        }));
        const tests = [
          ...result.publicTests.map((test, index) => ({
            index,
            visible: true,
            input: test.input,
            expectedOutput: test.expected,
            actualOutput: "",
            passed: test.passed,
            error: test.diagnostic ?? null
          })),
          ...hiddenTests
        ];
        const data = {
          language: "JavaScript (Node.js 22)",
          status: result.accepted
            ? `${tests.length}/${tests.length} tests passed`
            : result.status === "tests-failed"
              ? `${tests.filter((test) => test.passed).length}/${tests.length} tests passed`
              : result.status,
          accepted: result.accepted,
          stdout: "",
          stderr: result.diagnostic ?? "",
          compileOutput: result.status === "compile-error" ? (result.diagnostic ?? "") : "",
          time: `${result.durationMs / 1_000}`,
          memory: result.peakMemoryMb === null ? null : Math.round(result.peakMemoryMb * 1_024),
          tests
        };
        await app.interviewService.recordCodeExecution(
          ownerId,
          parsed.data.sessionId!,
          parsed.data.questionIndex!,
          {
            language: data.language,
            status: data.status,
            accepted: data.accepted,
            testsPassed: tests.filter((test) => test.passed).length,
            testCount: tests.length,
            compileOutput: data.compileOutput,
            stderr: data.stderr,
            time: data.time,
            memory: data.memory,
            recordedAt: Date.now(),
            codeHash: codeFingerprint(parsed.data.code)
          }
        );
        return apiSuccess(data);
      } finally {
        await lease.release();
      }
    }

    if (!config.rapidApiKey) {
      throw new ApiRouteError(
        503,
        "CODE_RUNNER_NOT_CONFIGURED",
        "The code runner is not configured."
      );
    }
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "X-RapidAPI-Key": config.rapidApiKey,
      "X-RapidAPI-Host": config.rapidApiHost
    };

    if (dsaFrozenTransfer) {
      slug = dsaFrozenTransfer.slug;
      try {
        // The full public + hidden runner contract was captured with the
        // assessment. Do not ask the mutable authored bank for structured
        // cases here; a completed assessment must remain reproducible.
        testCases = dsaFrozenTransfer.runnerContract.testCases;
        sourceCode = buildTestHarness(
          parsed.data.code,
          runnerLanguage,
          dsaFrozenTransfer.runnerContract.functionName,
          testCases
        );
      } catch (error) {
        throw new ApiRouteError(
          422,
          "TEST_HARNESS_UNAVAILABLE",
          error instanceof Error ? error.message : "This frozen problem cannot be run yet."
        );
      }
    } else if (slug) {
      const question = findQuestion(slug)?.question;
      if (!question) throw new ApiRouteError(404, "DSA_QUESTION_NOT_FOUND", "Question not found.");
      if (!question.examples?.length) {
        throw new ApiRouteError(
          422,
          "TEST_CASES_UNAVAILABLE",
          "This question has no runnable test cases yet."
        );
      }

      const functionName = dsaFunctionName(question.slug);
      try {
        testCases = buildTestCases(question.examples, slug);
        sourceCode = buildTestHarness(parsed.data.code, runnerLanguage, functionName, testCases);
      } catch (error) {
        throw new ApiRouteError(
          422,
          "TEST_HARNESS_UNAVAILABLE",
          error instanceof Error ? error.message : "This question cannot be run yet."
        );
      }
    }

    if (parsed.data.language === "typescript") {
      sourceCode = ts.transpileModule(sourceCode, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022
        }
      }).outputText;
    }

    const guard = getSharedGuard(config);
    await guard.enforce(RATE_LIMIT_POLICIES.codeExecution, ownerId);
    const lease = await guard.acquire(
      {
        namespace: "code-run",
        ttlMs: 25_000,
        code: "CODE_RUN_IN_PROGRESS",
        message: "Your previous code run is still in progress."
      },
      ownerId
    );

    try {
      const language =
        parsed.data.language === "python"
          ? await modernPythonLanguage(config.judge0Url, headers)
          : languages[parsed.data.language];
      const submissionResponse = await fetch(
        `${config.judge0Url}/submissions?base64_encoded=true&wait=true`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            language_id: language.id,
            source_code: Buffer.from(sourceCode, "utf8").toString("base64"),
            stdin: Buffer.from(parsed.data.stdin, "utf8").toString("base64"),
            cpu_time_limit: 5,
            wall_time_limit: 10,
            memory_limit: 256_000,
            max_processes_and_or_threads: 64,
            enable_network: false
          }),
          signal: AbortSignal.timeout(15_000)
        }
      );
      const result = (await submissionResponse.json().catch(() => null)) as JudgeResult | null;
      if (!submissionResponse.ok || !result) {
        throw new ApiRouteError(502, "CODE_RUN_FAILED", "Judge0 could not execute the submission.");
      }

      const stdout = decodeJudgeOutput(result.stdout);
      const tests = slug ? parseTestResults(stdout, testCases) : [];
      const passedCount = tests.filter((test) => test.passed).length;
      const executionAccepted = result.status?.description === "Accepted";
      const visibleOutput = stdout
        .split(/\r?\n/)
        .filter((line) => !line.startsWith(resultMarker()))
        .join("\n")
        .trim();

      const data = {
        language: language.name,
        status: !slug
          ? (result.status?.description ?? "Unknown")
          : executionAccepted
            ? `${passedCount}/${tests.length} tests passed`
            : (result.status?.description ?? "Unknown"),
        accepted: executionAccepted && (slug ? passedCount === tests.length : true),
        stdout: visibleOutput,
        stderr: decodeJudgeOutput(result.stderr),
        compileOutput: decodeJudgeOutput(result.compile_output),
        time: result.time ?? null,
        memory: result.memory ?? null,
        tests
      };

      // Matching needs evidence from the runner, not a self-reported "I solved
      // this" click. Persist after the response so roadmap bookkeeping never
      // adds latency to code execution. Interview runs keep their own evidence.
      if (slug && parsed.data.sessionId === undefined) {
        after(() =>
          app.frontendRoadmapService
            .recordCodeRunEvidence(ownerId, {
              idempotencyKey: parsed.data.requestId!,
              dsaQuestionSlug: slug,
              language: runnerLanguage,
              // Persist the candidate's editor text, never the generated
              // harness. Later block assessments must review exactly what the
              // candidate wrote alongside the verified runner result.
              sourceCode: parsed.data.code,
              score: tests.length > 0 ? passedCount / tests.length : data.accepted ? 1 : 0,
              accepted: data.accepted,
              testsPassed: passedCount,
              testCount: tests.length,
              // Only visible examples are retained as individual evidence.
              // Hidden cases remain aggregate-only and are never exposed to a
              // later assessment question.
              visibleTestEvidence: tests
                .filter((test) => test.visible)
                .slice(0, 3)
                .map((test) => ({
                  input: test.input,
                  expectedOutput: test.expectedOutput,
                  actualOutput: test.actualOutput,
                  error: test.error,
                  passed: test.passed
                }))
            })
            .catch(() => false)
        );
      }

      if (parsed.data.sessionId !== undefined && parsed.data.questionIndex !== undefined) {
        await app.interviewService.recordCodeExecution(
          ownerId,
          parsed.data.sessionId,
          parsed.data.questionIndex,
          {
            language: data.language,
            status: data.status,
            accepted: data.accepted,
            testsPassed: passedCount,
            testCount: tests.length,
            compileOutput: data.compileOutput.slice(0, 2_000),
            stderr: data.stderr.slice(0, 2_000),
            time: data.time,
            memory: data.memory,
            recordedAt: Date.now(),
            codeHash: codeFingerprint(parsed.data.code)
          }
        );
      }

      return apiSuccess(data);
    } finally {
      await lease.release();
    }
  } catch (error) {
    return apiError(error, request.nextUrl.pathname);
  }
}

interface JudgeResult {
  status?: { id: number; description: string };
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  time?: string | null;
  memory?: number | null;
}

function decodeJudgeOutput(value: string | null | undefined): string {
  return value ? Buffer.from(value, "base64").toString("utf8") : "";
}
