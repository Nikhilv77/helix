import { describe, expect, it, vi } from "vitest";
import {
  bufferCandidateInterimTranscript,
  buildCandidateTranscriptionConfig,
  candidateAnswerWasRecentlySubmitted,
  finishAuthoritativeInputTranscript,
  goAwayTimeLeftMs,
  liveConversationProposalFromToolArgs,
  mergeFinalizedCandidateTranscript,
  resampleToPcm16,
  selectGeminiLedCandidateTranscript,
  toolCallMatchesPendingTypedSubmission
} from "./gemini-live-interviewer";

describe("Gemini Live candidate transcript finalization", () => {
  it("connects the browser transcriber in bilingual verbatim mode", () => {
    expect(
      buildCandidateTranscriptionConfig({
        languageCodes: ["en-IN", "hi-IN"],
        vocabulary: ["NovaCart", "React.js"]
      })
    ).toEqual({
      languageCodes: ["en-IN", "hi-IN"],
      customVocabulary: ["NovaCart", "React.js"],
      mode: "VERBATIM"
    });
  });

  it("buffers interim revisions without rendering them", () => {
    const transcript = { current: "" };
    const emit = vi.fn();

    bufferCandidateInterimTranscript("Yeah, sure.", transcript);
    bufferCandidateInterimTranscript("Yeah, so there were many transitions.", transcript);
    bufferCandidateInterimTranscript(
      "Yeah, so there were many transitions. I was interested in computer science.",
      transcript
    );

    expect(emit).not.toHaveBeenCalled();
    expect(transcript.current).toBe(
      "Yeah, so there were many transitions. I was interested in computer science."
    );
    expect(transcript.current.match(/there were many transitions/g)).toHaveLength(1);
  });

  it("renders only the final candidate message after hidden interim revisions", () => {
    const transcript = { current: "" };
    const emit = vi.fn();

    bufferCandidateInterimTranscript("I was interested", transcript);
    bufferCandidateInterimTranscript("I was interested in computer science", transcript);
    finishAuthoritativeInputTranscript(
      "I was interested in computer science, so I studied engineering.",
      transcript,
      emit
    );

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith({
      text: "I was interested in computer science, so I studied engineering.",
      finished: true
    });
  });

  it("replaces a mistaken interim hypothesis with the Smart final transcript", () => {
    const transcript = { current: "I worked on over card using re-act" };
    const emit = vi.fn();

    const finalText = finishAuthoritativeInputTranscript(
      "I worked on NovaCart using React.",
      transcript,
      emit
    );

    expect(finalText).toBe("I worked on NovaCart using React.");
    expect(transcript.current).toBe("");
    expect(emit).toHaveBeenCalledWith({
      text: "I worked on NovaCart using React.",
      finished: true
    });
  });

  it("coalesces multiple finalized segments into one long candidate answer", () => {
    const first = mergeFinalizedCandidateTranscript(
      "I designed the API and chose cursor pagination.",
      "Then I added retries and idempotency for failed requests."
    );
    const complete = mergeFinalizedCandidateTranscript(
      first,
      "I designed the API and chose cursor pagination. Then I added retries and idempotency for failed requests. Finally, I measured the p95 latency."
    );

    expect(complete).toBe(
      "I designed the API and chose cursor pagination. Then I added retries and idempotency for failed requests. Finally, I measured the p95 latency."
    );
  });

  it("removes overlapping words when adjacent final segments repeat context", () => {
    expect(
      mergeFinalizedCandidateTranscript(
        "The main trade-off was consistency over latency",
        "consistency over latency because orders could not be duplicated."
      )
    ).toBe(
      "The main trade-off was consistency over latency because orders could not be duplicated."
    );
  });
});

describe("Gemini-led interview tool decisions", () => {
  it("recognizes only an immediate retried candidate turn", () => {
    const completed = {
      fingerprint: "i chose postgres because consistency mattered.",
      completedAtMs: 10_000
    };

    expect(
      candidateAnswerWasRecentlySubmitted(
        "  I CHOSE Postgres   because consistency mattered. ",
        completed,
        11_000
      )
    ).toBe(true);
    expect(
      candidateAnswerWasRecentlySubmitted("I chose Redis for lower latency.", completed, 11_000)
    ).toBe(false);
    expect(
      candidateAnswerWasRecentlySubmitted(
        "I chose Postgres because consistency mattered.",
        completed,
        13_000
      )
    ).toBe(false);
  });

  it("uses one transcript source instead of concatenating recognizer variants", () => {
    expect(
      selectGeminiLedCandidateTranscript(
        "Yeah, I've been an engineering student and wanted to work at NovaCart.",
        "Yeah, I've been engineering student and wanted to work at Nova cars."
      )
    ).toBe("Yeah, I've been an engineering student and wanted to work at NovaCart.");
  });

  it("does not let a nearby microphone turn consume the pending workspace marker", () => {
    const typed = "```javascript\nfunction solve() { return 1; }\n```";

    expect(toolCallMatchesPendingTypedSubmission(typed, typed)).toBe(true);
    expect(
      toolCallMatchesPendingTypedSubmission("I am still thinking about the hash map.", typed)
    ).toBe(false);
  });

  it("still recognises a submitted solution that Gemini echoed without its code fence", () => {
    const typed =
      "```javascript\nfunction solve(nums) {\n  return nums.length;\n}\n```\n\nReasoning and complexity: O(1).";
    const echoed = "function solve(nums) { return nums.length; } Reasoning and complexity: O(1).";
    expect(toolCallMatchesPendingTypedSubmission(echoed, typed)).toBe(true);
    // Gemini sometimes echoes only the code, without the written reasoning.
    expect(
      toolCallMatchesPendingTypedSubmission("function solve(nums) { return nums.length; }", typed)
    ).toBe(true);
    // A spoken remark made while a submission is pending is not that submission.
    expect(toolCallMatchesPendingTypedSubmission("Let me check the edge cases first.", typed)).toBe(
      false
    );
  });

  it("accepts the bounded conversational proposal sent by Gemini Live", () => {
    expect(
      liveConversationProposalFromToolArgs({
        action: "probe",
        missing: "specificity",
        candidateIntent: "answer",
        acknowledgement: "Reliability shaped that decision",
        line: "What trade-off did you accept to get that reliability?",
        candidateResponse: "",
        reason: "the trade-off is missing"
      })
    ).toEqual({
      action: "probe",
      missing: "specificity",
      candidateIntent: "answer",
      acknowledgement: "Reliability shaped that decision",
      line: "What trade-off did you accept to get that reliability?",
      candidateResponse: undefined,
      reason: "the trade-off is missing"
    });
  });

  it("rejects an action outside the server's state-machine vocabulary", () => {
    expect(() =>
      liveConversationProposalFromToolArgs({
        action: "ask_anything",
        missing: "none",
        acknowledgement: "",
        line: "Tell me about a new topic.",
        reason: "change topic"
      })
    ).toThrow("invalid interview decision");
  });
});

describe("Gemini Live microphone resampling", () => {
  it("low-pass averages high-rate samples instead of dropping two out of three", () => {
    const output = resampleToPcm16(new Float32Array([1, -1, 1, -1, 1, -1]), 48_000);

    expect(output).toHaveLength(2);
    expect(Math.abs(output[0]!)).toBeLessThan(16_384);
    expect(Math.abs(output[1]!)).toBeLessThan(16_384);
  });
});

describe("Gemini Live connection rotation", () => {
  it("reads the goAway time left as milliseconds", () => {
    expect(goAwayTimeLeftMs("30s")).toBe(30_000);
    expect(goAwayTimeLeftMs("1.5s")).toBe(1_500);
    expect(goAwayTimeLeftMs(undefined)).toBe(0);
    expect(goAwayTimeLeftMs("soon")).toBe(0);
  });
});
