import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { findQuestion } from "@/lib/dsa/dsa";
import { ApiRouteError } from "@/server/http/api-error";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { getAppContainer } from "@/server/app-container";
import {
  buildTestCases,
  buildTestHarness,
  parseTestResults,
  resultMarker
} from "@/server/dsa/code-test-harness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 20;

const runSchema = z.object({
  code: z.string().trim().min(1).max(20_000),
  language: z.enum(["python", "javascript", "cpp", "java"]),
  slug: z.string().trim().min(1).max(140),
  stdin: z.string().max(10_000).default("")
});

// Verified against Judge0 CE's RapidAPI /languages response on 2026-08-19.
const languages: Record<z.infer<typeof runSchema>["language"], { id: number; name: string }> = {
  cpp: { id: 54, name: "C++ (GCC 9.2.0)" },
  java: { id: 62, name: "Java (OpenJDK 13.0.1)" },
  javascript: { id: 63, name: "JavaScript (Node.js 12.14.0)" },
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

    const config = getAppContainer().config;
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
    const question = findQuestion(parsed.data.slug)?.question;
    if (!question) throw new ApiRouteError(404, "DSA_QUESTION_NOT_FOUND", "Question not found.");
    if (!question.examples?.length) {
      throw new ApiRouteError(422, "TEST_CASES_UNAVAILABLE", "This question has no runnable test cases yet.");
    }

    const functionName = question.slug.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
    let testCases;
    let sourceCode;
    try {
      testCases = buildTestCases(question.examples, parsed.data.slug);
      sourceCode = buildTestHarness(parsed.data.code, parsed.data.language, functionName, testCases);
    } catch (error) {
      throw new ApiRouteError(
        422,
        "TEST_HARNESS_UNAVAILABLE",
        error instanceof Error ? error.message : "This question cannot be run yet."
      );
    }

    const language = languages[parsed.data.language];

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
    const tests = parseTestResults(stdout, testCases);
    const passedCount = tests.filter((test) => test.passed).length;
    const executionAccepted = result.status?.description === "Accepted";
    const visibleOutput = stdout
      .split(/\r?\n/)
      .filter((line) => !line.startsWith(resultMarker()))
      .join("\n")
      .trim();

    return apiSuccess({
      language: language.name,
      status: executionAccepted ? `${passedCount}/${tests.length} tests passed` : result.status?.description ?? "Unknown",
      accepted: executionAccepted && passedCount === tests.length,
      stdout: visibleOutput,
      stderr: decodeJudgeOutput(result.stderr),
      compileOutput: decodeJudgeOutput(result.compile_output),
      time: result.time ?? null,
      memory: result.memory ?? null,
      tests
    });
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
