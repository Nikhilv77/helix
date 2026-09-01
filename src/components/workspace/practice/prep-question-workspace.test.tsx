import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrepPracticeQuestion } from "@/lib/practice/prep-practice";
import { newFinalTranscript, PrepQuestionWorkspace } from "./prep-question-workspace";

const routerPush = vi.fn();
const routerRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: routerRefresh, push: routerPush })
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  routerPush.mockReset();
  routerRefresh.mockReset();
});

describe("PrepQuestionWorkspace", () => {
  it("renders learner-visible MCQ options while gating the key and explanation", () => {
    render(
      <PrepQuestionWorkspace question={fixture({ format: "mcq", options: ["Cache", "Origin"] })} />
    );

    expect(screen.getByRole("radio", { name: "Cache" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Origin" })).toBeTruthy();
    expect(screen.queryByText("Authored explanation")).toBeNull();
    expect(document.body.textContent).not.toContain("correctOptionIndex");
    expect(screen.getByText(/Submit your answer to unlock rubric feedback/i)).toBeTruthy();
  });

  it("provides distinct spoken and diagram answer surfaces", () => {
    const { unmount } = render(<PrepQuestionWorkspace question={fixture({ format: "spoken" })} />);
    expect(screen.getByRole("button", { name: "Dictate" })).toBeTruthy();
    expect(screen.getByLabelText("Your spoken answer")).toBeTruthy();
    unmount();

    render(<PrepQuestionWorkspace question={fixture({ format: "diagram" })} />);
    expect(screen.getByLabelText("Your diagram outline")).toBeTruthy();
    expect(screen.getByPlaceholderText(/Clients -> edge\/cache/i)).toBeTruthy();
  });

  it("stops the active recognition session and appends each final result only once", () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("SpeechRecognition", FakeSpeechRecognition);
    render(<PrepQuestionWorkspace question={fixture({ format: "spoken" })} />);

    fireEvent.click(screen.getByRole("button", { name: "Dictate" }));
    const recognition = FakeSpeechRecognition.latest!;
    expect(recognition.start).toHaveBeenCalledTimes(1);

    const event = recognitionEvent(0, [finalResult("Explain the cache mechanism")]);
    act(() => recognition.onresult?.(event));
    act(() => recognition.onresult?.(event));
    expect((screen.getByLabelText("Your spoken answer") as HTMLTextAreaElement).value).toBe(
      "Explain the cache mechanism"
    );

    fireEvent.click(screen.getByRole("button", { name: "Stop dictation" }));
    expect(recognition.stop).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Stopping dictation…" })).toBeTruthy();
    act(() => recognition.onend?.());
    expect(screen.getByRole("button", { name: "Dictate" })).toBeTruthy();
  });

  it("includes the final stop-time transcript in the submitted answer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("SpeechRecognition", FakeSpeechRecognition);
    render(<PrepQuestionWorkspace question={fixture({ format: "spoken" })} />);

    fireEvent.click(screen.getByRole("button", { name: "Dictate" }));
    const recognition = FakeSpeechRecognition.latest!;
    recognition.stop.mockImplementation(() => {
      recognition.onresult?.(
        recognitionEvent(0, [finalResult("This final spoken answer explains the mechanism.")])
      );
      recognition.onend?.();
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit answer" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const attemptCall = fetchMock.mock.calls.find(([url]) => url === "/api/practice/attempt");
    expect(attemptCall).toBeTruthy();
    expect(JSON.parse(String((attemptCall![1] as RequestInit).body))).toMatchObject({
      answer: "This final spoken answer explains the mechanism."
    });
  });

  it("consumes resultIndex deltas while leaving interim results available for finalization", () => {
    const consumed = new Set<number>();
    expect(newFinalTranscript(recognitionEvent(0, [finalResult("first")]), consumed)).toBe("first");
    expect(newFinalTranscript(recognitionEvent(0, [finalResult("first")]), consumed)).toBe("");
    expect(
      newFinalTranscript(
        recognitionEvent(1, [finalResult("first"), interimResult("still speaking")]),
        consumed
      )
    ).toBe("");
    expect(
      newFinalTranscript(
        recognitionEvent(1, [finalResult("first"), finalResult("second")]),
        consumed
      )
    ).toBe("second");
  });

  it("only offers evaluated submission or skip, never manual completion", () => {
    render(<PrepQuestionWorkspace question={fixture()} />);

    expect(screen.getByRole("button", { name: "Submit answer" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Skip for now" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /mark complete/i })).toBeNull();
  });

  it("shows evaluator outages as pending verification rather than a score", () => {
    render(
      <PrepQuestionWorkspace
        question={fixture({
          review: {
            score: null,
            correctness: "unverified",
            summary: "Your answer is saved, but evaluation is temporarily unavailable.",
            strengths: [],
            missing: [],
            explanation: "Authored explanation.",
            correctOptionIndex: null,
            expectedOutput: null,
            flaw: null,
            diagnosis: null,
            verificationStatus: "UNVERIFIED",
            evaluatorVersion: "prep-rubric-v1",
            questionContentVersion: 1,
            rubricBand: null,
            rubricRationale: null
          }
        })}
      />
    );

    expect(screen.getByText(/Review ·\s*Pending verification/i)).toBeTruthy();
    expect(document.body.textContent).not.toContain("Review · 0%");
  });

  it("debounces draft saves and marks them as keepalive requests", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);
    render(<PrepQuestionWorkspace question={fixture()} />);

    fireEvent.change(screen.getByLabelText("Your answer"), {
      target: { value: "First version of my cache answer." }
    });
    fireEvent.change(screen.getByLabelText("Your answer"), {
      target: { value: "Latest version of my cache answer." }
    });

    expect(screen.getByText("Unsaved changes")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(700));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.keepalive).toBe(true);
    expect(JSON.parse(String(init.body))).toMatchObject({
      draftAnswer: "Latest version of my cache answer."
    });
  });

  it("flushes the latest draft and note before navigating", async () => {
    const stateSave = deferred<Response>();
    const fetchMock = vi.fn().mockReturnValue(stateSave.promise);
    vi.stubGlobal("fetch", fetchMock);
    render(<PrepQuestionWorkspace question={fixture()} />);

    fireEvent.change(screen.getByLabelText("Your answer"), {
      target: { value: "A concrete answer that is still inside the debounce window." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Notes" }));
    fireEvent.change(screen.getByPlaceholderText(/Capture the mechanism/i), {
      target: { value: "Remember the single-flight refill trade-off." }
    });
    fireEvent.click(screen.getByRole("link", { name: /Next question/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(routerPush).not.toHaveBeenCalled();
    const body = JSON.parse(String((fetchMock.mock.calls[0]![1] as RequestInit).body));
    expect(body).toMatchObject({
      draftAnswer: "A concrete answer that is still inside the debounce window.",
      note: "Remember the single-flight refill trade-off."
    });

    stateSave.resolve(okResponse());
    await waitFor(() => expect(routerPush).toHaveBeenCalledWith(fixture().nextHref));
  });

  it("starts a keepalive flush when the workspace unmounts inside the debounce window", () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<PrepQuestionWorkspace question={fixture()} />);

    fireEvent.change(screen.getByLabelText("Your answer"), {
      target: { value: "Do not lose this in-flight draft during a route change." }
    });
    view.unmount();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0]![1] as RequestInit).keepalive).toBe(true);
  });
});

function okResponse(): Response {
  return { ok: true } as Response;
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

class FakeSpeechRecognition {
  static latest: FakeSpeechRecognition | null = null;
  continuous = false;
  interimResults = false;
  onresult: ((event: ReturnType<typeof recognitionEvent>) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();

  constructor() {
    FakeSpeechRecognition.latest = this;
  }
}

function finalResult(transcript: string) {
  return { 0: { transcript }, length: 1, isFinal: true };
}

function interimResult(transcript: string) {
  return { 0: { transcript }, length: 1, isFinal: false };
}

function recognitionEvent(
  resultIndex: number,
  values: Array<ReturnType<typeof finalResult> | ReturnType<typeof interimResult>>
) {
  return {
    resultIndex,
    results: Object.assign({ length: values.length }, values)
  };
}

function fixture(overrides: Partial<PrepPracticeQuestion> = {}): PrepPracticeQuestion {
  return {
    sessionKey: "applied-engineering",
    sessionTitle: "Applied Engineering",
    id: "fundamentals-cache",
    progressId: "progress-1",
    order: 1,
    totalInSession: 12,
    chapterKey: "systems",
    chapterTitle: "Systems",
    title: "Cache behavior",
    prompt: "Explain what happens when a popular cache key expires under heavy concurrency.",
    objective: "Connect the cache mechanism to load and recovery behavior.",
    difficulty: "medium",
    format: "typed",
    expectedMinutes: 8,
    options: [],
  snippet: null,
  artifact: null,
    hints: ["Think about simultaneous misses.", "Consider single-flight refill behavior."],
    revealedHintCount: 0,
    draftAnswer: "",
    note: "",
    status: "ACTIVE",
    attemptCount: 0,
    bestScore: null,
    previousHref: null,
    nextHref: "/practice/applied-engineering/next",
    sessionHref: "/practice/applied-engineering",
    review: null,
    ...overrides
  };
}
