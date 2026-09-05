import { auth } from "@clerk/nextjs/server";
import { after } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { findQuestion } from "@/lib/dsa/dsa";
import { dsaFunctionName } from "@/lib/dsa/dsa-code-templates";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { getAppContainer } from "@/server/app-container";
import { authenticatedOwnerId } from "@/server/interview/owner";
import { codeFingerprint } from "@/server/interview/code-fingerprint";
import {
  buildTestCases,
  buildTestHarness,
  parseTestResults,
  resultMarker
} from "@/server/dsa/code-test-harness";
import { getSharedGuard, RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 20;

const runSchema = z
  .object({
    /** Required for standalone practice runs so evidence writes are idempotent. */
    requestId: z.string().uuid().optional(),
    code: z.string().trim().min(1).max(20_000),
    language: z.enum(["python", "javascript", "cpp", "java"]),
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

// Verified against Judge0 CE's RapidAPI /languages response on 2026-08-27.
// Node 20 supports the syntax taught by the current editor, and GCC 14
// supports the C++17 optional values used by the tree harness.
const languages: Record<z.infer<typeof runSchema>["language"], { id: number; name: string }> = {
  cpp: { id: 105, name: "C++ (GCC 14.1.0)" },
  java: { id: 62, name: "Java (OpenJDK 13.0.1)" },
  javascript: { id: 97, name: "JavaScript (Node.js 20.17.0)" },
  python: { id: 71, name: "Python (3.8.1)" }
};

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
    let slug = parsed.data.slug;
    let testCases: ReturnType<typeof buildTestCases> = [];
    let sourceCode = parsed.data.code;

    // A block assessment is pinned to the immutable assessment record. The
    // browser's slug is ignored entirely for these sessions, so an old tab or
    // crafted request cannot execute a changed/live-bank question instead.
    const frozenTransfer =
      parsed.data.sessionId !== undefined && parsed.data.questionIndex !== undefined
        ? await app.dsaBlockAssessmentRuntimeService.frozenTransferForRun(
            ownerId,
            parsed.data.sessionId,
            parsed.data.questionIndex
          )
        : null;

    if (frozenTransfer) {
      slug = frozenTransfer.slug;
      try {
        // The full public + hidden runner contract was captured with the
        // assessment. Do not ask the mutable authored bank for structured
        // cases here; a completed assessment must remain reproducible.
        testCases = frozenTransfer.runnerContract.testCases;
        sourceCode = buildTestHarness(
          parsed.data.code,
          parsed.data.language,
          frozenTransfer.runnerContract.functionName,
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
        sourceCode = buildTestHarness(
          parsed.data.code,
          parsed.data.language,
          functionName,
          testCases
        );
      } catch (error) {
        throw new ApiRouteError(
          422,
          "TEST_HARNESS_UNAVAILABLE",
          error instanceof Error ? error.message : "This question cannot be run yet."
        );
      }
    }

    const language = languages[parsed.data.language];

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
              language: parsed.data.language,
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
