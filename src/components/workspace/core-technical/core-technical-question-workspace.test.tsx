import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CoreTechnicalQuestionFormat } from "@/lib/practice/core-technical/contracts";
import type {
  CoreTechnicalPublicBlock,
  CoreTechnicalPublicQuestion
} from "@/server/core-technical/practice.service";

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/components/interview/dsa/dsa-code-editor", () => ({
  DsaCodeEditor: ({
    value,
    onChange,
    readOnly,
    ariaLabel
  }: {
    value: string;
    onChange: (value: string) => void;
    readOnly: boolean;
    ariaLabel: string;
  }) => (
    <textarea
      aria-label={ariaLabel}
      value={value}
      readOnly={readOnly}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}));

import { CoreTechnicalQuestionWorkspace } from "./core-technical-question-workspace";

describe("CoreTechnicalQuestionWorkspace", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.refresh.mockReset();
    window.sessionStorage.clear();
  });

  it("renders every public format through its explicit response control", () => {
    const formats: Array<[CoreTechnicalQuestionFormat, RegExp]> = [
      ["mcq", /Choose the strongest explanation/i],
      ["predict-explain", /Predict and explain/i],
      ["written", /Write your reasoning/i],
      ["spoken", /Speak, then capture your answer/i],
      ["artifact-diagnosis", /Diagnose the evidence/i],
      ["debug-repair", /Repair the implementation/i],
      ["micro-implementation", /Implement the missing behavior/i],
      ["production-decision", /Make the production decision/i]
    ];

    for (const [format, label] of formats) {
      const question = makeQuestion(format);
      const view = render(
        <CoreTechnicalQuestionWorkspace
          block={makeBlock(question)}
          initialQuestion={question}
          stageTitle="Trace the runtime"
        />
      );
      expect(screen.getByRole("heading", { name: label })).toBeInTheDocument();
      expect(
        screen.getByRole("tablist", { name: "Core Technical question reference" })
      ).toBeInTheDocument();
      if (format === "debug-repair" || format === "micro-implementation") {
        expect(screen.getByText("8 min")).toBeInTheDocument();
        expect(screen.getByLabelText("Core Technical JavaScript editor")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Test cases" })).toBeInTheDocument();
      } else {
        expect(
          screen.getByText(format === "production-decision" ? "4 min" : "5 min")
        ).toBeInTheDocument();
        expect(screen.queryByLabelText("Core Technical JavaScript editor")).toBeNull();
        expect(screen.queryByRole("button", { name: "Test cases" })).toBeNull();
      }
      view.unmount();
    }
  });

  it("renders a code evidence artifact in a read-only themed editor without changing the answer control", () => {
    const question = makeQuestion("artifact-diagnosis");
    question.question.artifact = {
      kind: "code",
      title: "flaky-test-suite",
      content: "import { test } from 'node:test';\n\ntest('finishes', async () => {});"
    };

    render(
      <CoreTechnicalQuestionWorkspace
        block={makeBlock(question)}
        initialQuestion={question}
        stageTitle="Make an async test deterministic"
      />
    );

    expect(screen.getByLabelText("flaky-test-suite code artifact, read only")).toHaveAttribute(
      "readonly"
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Make an async test deterministic" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Written answer")).toBeInTheDocument();
    expect(screen.queryByLabelText("Core Technical JavaScript editor")).toBeNull();
  });

  it("completes every public format through its Step 12 run and attempt paths", async () => {
    const formats: CoreTechnicalQuestionFormat[] = [
      "mcq",
      "predict-explain",
      "written",
      "spoken",
      "artifact-diagnosis",
      "debug-repair",
      "micro-implementation",
      "production-decision"
    ];

    for (const format of formats) {
      const question = makeQuestion(format);
      const code = format === "debug-repair" || format === "micro-implementation";
      const run = makeRun(true);
      const completed = {
        ...question,
        status: "COMPLETED",
        latestRun: code ? { ...run, requestId: "run-request", passed: true } : null,
        latestAttempt: makeAttempt(
          format === "mcq"
            ? { kind: "choice", selectedChoiceIndex: 1 }
            : code
              ? { kind: "code", code: run.code, runId: run.id }
              : { kind: "text", text: `Complete ${format} reasoning` }
        ),
        authorizedAnswer: {
          concise: "Name the runtime mechanism.",
          explanation: "Connect the mechanism to the observed production evidence."
        }
      } as CoreTechnicalPublicQuestion;
      const calls: string[] = [];
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
        const url = String(input);
        calls.push(url);
        if (url.endsWith("/run"))
          return response({ run: { id: run.id, result: run.result, createdAt: run.createdAt } });
        if (url.endsWith("/attempt"))
          return response({ attempt: completed.latestAttempt, question: completed });
        if (url.endsWith("/draft")) return response({ question });
        throw new Error(`Unexpected request: ${url}`);
      });

      const view = render(
        <CoreTechnicalQuestionWorkspace
          block={makeBlock(question)}
          initialQuestion={question}
          stageTitle={`Complete ${format}`}
        />
      );
      if (format === "mcq") {
        fireEvent.click(screen.getByRole("radio", { name: "Promise callback" }));
      } else if (code) {
        fireEvent.click(screen.getByRole("button", { name: "Run code" }));
        await screen.findByText("All tests accepted");
      } else {
        fireEvent.change(screen.getByRole("textbox"), {
          target: { value: `Complete ${format} reasoning` }
        });
      }
      fireEvent.click(screen.getByRole("button", { name: "Submit answer" }));
      await screen.findByRole("heading", { name: /10\/10 · Strong answer/i });
      expect(calls).toContain("/api/practice/core-technical/attempt");
      if (code) expect(calls).toContain("/api/practice/core-technical/run");
      view.unmount();
      vi.restoreAllMocks();
    }
  });

  it("persists an MCQ draft, reveals the next hint, and submits through Step 12 APIs", async () => {
    const question = makeQuestion("mcq");
    const attempted = {
      ...question,
      status: "COMPLETED",
      revealedHints: ["Trace the first queue boundary."],
      latestAttempt: makeAttempt({ kind: "choice", selectedChoiceIndex: 1 }),
      authorizedAnswer: {
        concise: "The promise callback runs before the timer callback.",
        explanation: "The microtask checkpoint is drained before the timers phase continues."
      },
      question: {
        ...question.question,
        interviewConnection: "Interviewers use this to test whether queue ordering is causal."
      }
    } as CoreTechnicalPublicQuestion;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/draft")) return response({ question });
      if (url.endsWith("/hint")) {
        return response({
          question: { ...question, revealedHints: ["Trace the first queue boundary."] }
        });
      }
      if (url.endsWith("/attempt"))
        return response({ attempt: attempted.latestAttempt, question: attempted });
      throw new Error(`Unexpected request: ${url} ${init?.method}`);
    });

    render(
      <CoreTechnicalQuestionWorkspace
        block={makeBlock(question)}
        initialQuestion={question}
        stageTitle="Trace the runtime"
      />
    );
    fireEvent.click(screen.getByRole("radio", { name: "Promise callback" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/practice/core-technical/draft",
        expect.objectContaining({ body: expect.stringContaining('"selectedChoiceIndex":1') })
      )
    );

    fireEvent.click(screen.getByRole("tab", { name: /Hints/i }));
    fireEvent.click(screen.getByRole("button", { name: /Reveal hint 1 of 3/i }));
    expect(await screen.findByText(/Trace the first queue boundary/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Submit answer" }));
    expect(
      await screen.findByRole("heading", { name: /10\/10 · Strong answer/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Interviewers use this/)).toBeInTheDocument();
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("binds executable submission to the accepted run for the exact editor code", async () => {
    const question = makeQuestion("debug-repair");
    const run = makeRun(true);
    const completed = {
      ...question,
      status: "COMPLETED",
      latestRun: { ...run, requestId: "run-request", passed: true },
      latestAttempt: makeAttempt({ kind: "code", code: run.code, runId: run.id }),
      authorizedAnswer: {
        concise: "Propagate the rejection after cleanup.",
        explanation: "The repaired function preserves both cleanup and failure semantics.",
        referenceSolution: run.code
      }
    } as CoreTechnicalPublicQuestion;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/run"))
        return response({ run: { id: run.id, result: run.result, createdAt: run.createdAt } });
      if (url.endsWith("/attempt")) {
        const body = JSON.parse(String(init?.body)) as { work: unknown };
        expect(body.work).toEqual({ kind: "code", code: run.code, runId: run.id });
        return response({ attempt: completed.latestAttempt, question: completed });
      }
      if (url.endsWith("/draft")) return response({ question });
      throw new Error(`Unexpected request: ${url}`);
    });

    render(
      <CoreTechnicalQuestionWorkspace
        block={makeBlock(question)}
        initialQuestion={question}
        stageTitle="Repair the boundary"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Run code" }));
    expect(await screen.findByText("All tests accepted")).toBeInTheDocument();
    expect(screen.getByText("Input")).toBeInTheDocument();
    expect(screen.getByText("Expected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Test cases.*1\/1.*2 hidden/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Submit answer" }));
    expect(
      await screen.findByRole("heading", { name: /10\/10 · Strong answer/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Reference solution code, read only")).toHaveAttribute("readonly");
  });

  it("requires explicit confirmation before Learn and restores the server-owned terminal state", async () => {
    const question = makeQuestion("written");
    const learned = {
      ...question,
      status: "LEARNED",
      authorizedAnswer: {
        concise: "Bound concurrency prevents resource exhaustion.",
        explanation: "A limit makes pressure explicit and keeps latency predictable."
      }
    } as CoreTechnicalPublicQuestion;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/learn")) return response({ question: learned });
      throw new Error(`Unexpected request: ${url}`);
    });

    render(
      <CoreTechnicalQuestionWorkspace
        block={makeBlock(question)}
        initialQuestion={question}
        stageTitle="Explain the constraint"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Learn instead" }));
    expect(screen.getByText(/contributes zero Practice mastery/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm Learn" }));

    expect(await screen.findByText("Learned · zero mastery")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit answer" })).toBeNull();
  });

  it("announces evaluator failure and retries an unchanged answer with the same request ID", async () => {
    const question = makeQuestion("written");
    const completed = {
      ...question,
      status: "COMPLETED",
      latestAttempt: makeAttempt({ kind: "text", text: "Complete evidence answer" }),
      authorizedAnswer: {
        concise: "Use bounded concurrency.",
        explanation: "The saved evidence shows why the resource limit matters."
      }
    } as CoreTechnicalPublicQuestion;
    const bodies: Array<{ requestId: string; work: unknown }> = [];
    let attempt = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/draft")) return response({ question });
      if (url.endsWith("/attempt")) {
        bodies.push(JSON.parse(String(init?.body)) as { requestId: string; work: unknown });
        attempt += 1;
        if (attempt === 1) {
          return new Response(
            JSON.stringify({
              success: false,
              error: { message: "Evaluation is temporarily unavailable. Your draft is safe." }
            }),
            { status: 503, headers: { "content-type": "application/json" } }
          );
        }
        return response({ attempt: completed.latestAttempt, question: completed });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(
      <CoreTechnicalQuestionWorkspace
        block={makeBlock(question)}
        initialQuestion={question}
        stageTitle="Explain the constraint"
      />
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Complete evidence answer" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit answer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/draft is safe/i);
    fireEvent.click(screen.getByRole("button", { name: "Submit answer" }));

    await screen.findByRole("heading", { name: /10\/10 · Strong answer/i });
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toEqual(bodies[0]);
  });
});

function makeBlock(question: CoreTechnicalPublicQuestion): CoreTechnicalPublicBlock {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    ordinal: 1,
    isCurrent: true,
    status: "PRACTISING",
    story: {
      title: "The request that returned twice",
      premise: "A production request crosses asynchronous boundaries during an incident.",
      expectedMinutes: 45,
      mechanismKeys: ["event-loop"],
      stages: []
    },
    selection: {
      difficulty: "guided",
      reason: "This story matches your saved Node.js assessment evidence."
    },
    questions: [question]
  } as unknown as CoreTechnicalPublicBlock;
}

function makeQuestion(format: CoreTechnicalQuestionFormat): CoreTechnicalPublicQuestion {
  const code = format === "debug-repair" || format === "micro-implementation";
  return {
    id: "11111111-1111-4111-8111-111111111111",
    blockId: "22222222-2222-4222-8222-222222222222",
    order: 1,
    questionKey: `question-${format}`,
    contentVersion: 1,
    contentFingerprint: `sha256:${"a".repeat(64)}`,
    status: "ACTIVE",
    question: {
      key: `question-${format}`,
      storyKey: "request-returned-twice",
      stageKey: "trace-runtime",
      order: 1,
      format,
      topicKeys: ["async-scheduling"],
      prompt: "What happens next, and which runtime mechanism proves your answer?",
      artifact: {
        kind: code ? "code" : "trace",
        title: "Observed request trace",
        content: "request:start\npromise:queued\ntimer:queued\nrequest:end"
      },
      choices:
        format === "mcq" ? ["Timer callback", "Promise callback", "Both together"] : undefined,
      hintCount: 3,
      starterCode: code ? "export async function repair() { return true; }" : undefined,
      publicTests: code
        ? [
            {
              name: "returns once",
              input: "none",
              expected: "true",
              testCode: "assert.equal(await solution.repair(), true);"
            }
          ]
        : undefined,
      runnerContract: code
        ? {
            language: "javascript",
            runtime: "nodejs",
            runtimeVersion: "22",
            entrypoint: "solution.mjs",
            timeoutMs: 1_000,
            memoryMb: 64,
            networkAccess: false
          }
        : undefined,
      interviewConnection: undefined
    },
    draft: null,
    revealedHints: [],
    authorizedAnswer: null,
    latestAttempt: null,
    latestRun: null,
    completedAt: null,
    learnedAt: null,
    updatedAt: "2026-09-07T10:00:00.000Z"
  } as CoreTechnicalPublicQuestion;
}

function makeAttempt(work: NonNullable<CoreTechnicalPublicQuestion["latestAttempt"]>["work"]) {
  return {
    id: "attempt-one",
    requestId: "33333333-3333-4333-8333-333333333333",
    work,
    feedback: {
      schemaVersion: 1 as const,
      score: 10,
      result: "Strong answer",
      mechanism: "The answer follows the event-loop ordering rule.",
      didWell: "You named the governing mechanism.",
      missingOrIncorrect: "Nothing material was missing.",
      productionConsequence: "Ordering changes observable request behavior.",
      transferExample: "Apply the same reasoning across an I/O boundary.",
      interviewerFollowUp: "How does this change after poll?",
      missedEdgeCases: []
    },
    verificationStatus: "VERIFIED",
    score: 10,
    createdAt: "2026-09-07T10:02:00.000Z"
  } as NonNullable<CoreTechnicalPublicQuestion["latestAttempt"]>;
}

function makeRun(accepted: boolean) {
  const code = "export async function repair() { return true; }";
  return {
    id: "44444444-4444-4444-8444-444444444444",
    code,
    createdAt: "2026-09-07T10:01:00.000Z",
    result: {
      accepted,
      status: accepted ? ("accepted" as const) : ("tests-failed" as const),
      codeFingerprint: `sha256:${"b".repeat(64)}`,
      testSuiteFingerprint: `sha256:${"c".repeat(64)}`,
      runnerIdentity: "test-sandbox",
      runnerVersion: "core-technical-nodejs-22.23.2-isolated-v1",
      runtimeVersion: "22.23.2",
      limits: {
        timeoutMs: 1_000,
        memoryMb: 64,
        outputBytes: 65_536,
        filesystem: "read-only-submission" as const,
        processes: 1 as const,
        network: false as const
      },
      publicTests: [{ name: "returns once", input: "none", expected: "true", passed: accepted }],
      hiddenTests: { passed: accepted ? 2 : 0, total: 2 },
      durationMs: 12,
      peakMemoryMb: 24
    }
  };
}

function response(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}
