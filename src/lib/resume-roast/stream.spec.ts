import { describe, expect, it } from "vitest";
import type { ResumeRoastResult, ResumeRoastTarget } from "./contracts";
import {
  createResumeRoastEventParser,
  encodeResumeRoastStreamEvent,
  resumeRoastResultEvents,
  ResumeRoastStreamParseError
} from "./stream";

const target: ResumeRoastTarget = {
  role: "backend-engineer",
  companyEnvironment: "product-company",
  level: "senior"
};
const result: ResumeRoastResult = {
  openingRoast: "This bullet took the scenic route to the point.",
  spokenSummary:
    "Your strongest work is here, but a few outcomes wandered off before the resume was saved. The experience sounds useful; it just needs clearer proof.",
  strength: {
    headline: "Real ownership",
    explanation: "The resume gives an observable system result.",
    evidenceAnchors: ["experience-1-achievement-1"]
  },
  problems: [
    {
      joke: "The outcome has apparently gone remote.",
      issue: "The second bullet does not state a result.",
      recruiterImpact: "Readers cannot assess the work quickly.",
      improvement: "Add the supported outcome to that bullet.",
      evidenceAnchors: ["experience-1-summary"]
    }
  ],
  rewrite: {
    before: "Built the payments API.",
    after: "Built the payments API with idempotent retry handling.",
    rationale: "The rewrite makes the mechanism clearer without adding a metric.",
    evidenceAnchor: "experience-1-summary"
  },
  verdict: {
    band: "has-potential",
    explanation: "The evidence is useful but unevenly presented.",
    targetFitScore: 64
  },
  actionPlan: [
    { priority: 1, action: "Add the outcome", rationale: "It is the clearest missing evidence." }
  ]
};

describe("Resume Roast SSE contract", () => {
  it("emits validated semantic sections in the client display order", () => {
    const events = resumeRoastResultEvents({
      roastId: "11111111-1111-4111-8111-111111111111",
      replayed: false,
      target,
      result
    });

    expect(events.map((event) => event.type)).toEqual([
      "session",
      "opening_roast",
      "spoken_summary",
      "strength",
      "problem",
      "rewrite",
      "verdict",
      "action_plan",
      "done"
    ]);
  });

  it("round-trips frames split across arbitrary stream chunks", () => {
    const encoded = resumeRoastResultEvents({
      roastId: "11111111-1111-4111-8111-111111111111",
      replayed: true,
      target,
      result
    })
      .map(encodeResumeRoastStreamEvent)
      .join("");
    const parser = createResumeRoastEventParser();
    const received = [
      ...parser.push(encoded.slice(0, 17)),
      ...parser.push(encoded.slice(17, 143)),
      ...parser.push(encoded.slice(143))
    ];

    expect(received.map((event) => event.type)).toEqual([
      "session",
      "opening_roast",
      "spoken_summary",
      "strength",
      "problem",
      "rewrite",
      "verdict",
      "action_plan",
      "done"
    ]);
    expect(parser.finish()).toEqual([]);
  });

  it("accepts CRLF framing when a line ending is split across chunks", () => {
    const encoded = encodeResumeRoastStreamEvent({ type: "done" }).replace(/\n/g, "\r\n");
    const split = encoded.indexOf("\r\n") + 1;
    const parser = createResumeRoastEventParser();

    expect(parser.push(encoded.slice(0, split))).toEqual([]);
    expect(parser.push(encoded.slice(split))).toEqual([{ type: "done" }]);
    expect(parser.finish()).toEqual([]);
  });

  it("rejects malformed, unvalidated, and truncated semantic events", () => {
    expect(() => encodeResumeRoastStreamEvent({ type: "done", extra: true } as never)).toThrow();
    const parser = createResumeRoastEventParser();
    expect(() => parser.push('event: opening_roast\ndata: {"type":"opening_roast"}\n\n')).toThrow(
      ResumeRoastStreamParseError
    );
    expect(() =>
      createResumeRoastEventParser().push('event: done\ndata: {"type":"error","code":"nope"}\n\n')
    ).toThrow(ResumeRoastStreamParseError);
    const truncated = createResumeRoastEventParser();
    truncated.push('event: done\ndata: {\\"type\\":\\"done\\"}');
    expect(() => truncated.finish()).toThrow(ResumeRoastStreamParseError);
  });
});
