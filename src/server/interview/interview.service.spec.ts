import { InterviewDecider } from "./decider";
import { InterviewPlanner } from "./planner";
import { InterviewService } from "./interview.service";
import { MemorySessionStore } from "./session-store";
import type { InterviewSetup, PlannedQuestion } from "./types";

const setup: InterviewSetup = {
  role: "frontend",
  level: "3-5",
  roundType: "technical",
  intensity: "realistic",
  context: "Built a collaborative editor and owned its offline synchronization."
};

const questions: PlannedQuestion[] = [
  {
    text: "What part of the editor did you personally own?",
    competency: "Ownership",
    intent: "Separate personal contribution from the wider team's work.",
    mustHit: ["personal scope", "specific implementation"],
    probeIfMissing: "Which implementation decision was yours alone?"
  },
  {
    text: "Which synchronization trade-off had the largest user impact?",
    competency: "Technical judgement",
    intent: "Understand how the candidate balanced consistency and usability.",
    mustHit: ["trade-off", "user impact"],
    probeIfMissing: "What did users lose because of that choice?"
  }
];

function harness(plan = questions) {
  const planner = {
    plan: jest.fn().mockResolvedValue(plan)
  } as unknown as InterviewPlanner;
  const decide = jest.fn();
  const decider = { decide } as unknown as InterviewDecider;
  const service = new InterviewService(planner, decider, new MemorySessionStore(), 10);

  return { service, decide };
}

describe("InterviewService conversation", () => {
  it("opens as a calm, named interviewer", async () => {
    const { service } = harness();
    const result = await service.start(setup, "user-1", 1_000);

    expect(result.utterance).toContain("I'm Maya, your Trailgrad interviewer");
    expect(result.utterance).toContain(questions[0]?.text);
    expect(result.utterance).toContain("pause to think");
  });

  it("opens resume rounds as a conversation rather than a scripted interview", async () => {
    const { service } = harness();
    const result = await service.start(
      {
        ...setup,
        roundType: "behavioral",
        templateId: "resume-behavioral-defense",
        templateTitle: "Resume and Behavioral Defense"
      },
      "user-1",
      1_000
    );

    expect(result.utterance).toContain("relaxed conversation about the work on your resume");
    expect(result.utterance).not.toContain("Ready? Let's begin.");
  });

  it("opens DSA rounds with a dedicated Maya introduction", async () => {
    const { service } = harness([questions[0]!, questions[1]!, questions[0]!]);
    const result = await service.start(
      {
        ...setup,
        templateTitle: "DSA practice interview",
        questionCount: 3,
        agenda: ["Explain the approach", "Discuss complexity"]
      },
      "user-1",
      1_000
    );

    expect(result.state.plan).toHaveLength(3);
    expect(result.utterance).toContain("Welcome to your DSA interview");
    expect(result.utterance).toContain(questions[0]?.text);
  });

  it("passes prior conversation and question intent into follow-up decisions", async () => {
    const { service, decide } = harness();
    const started = await service.start(setup, "user-1", 1_000);
    decide.mockResolvedValue({
      action: "move_on",
      missing: "none",
      reason: "enough ownership evidence",
      acknowledgement: "That gives me the context",
      line: ""
    });

    const result = await service.answer(
      started.state.id,
      {
        text: "I owned the conflict resolver and shipped the retry queue.",
        startMs: 500,
        endMs: 4_000
      },
      6_000
    );

    expect(decide).toHaveBeenCalledWith(
      expect.objectContaining({
        competency: "Ownership",
        intent: questions[0]?.intent,
        conversationHistory: expect.arrayContaining([expect.objectContaining({ speaker: "agent" })])
      })
    );
    expect(result.decision.utterance).toContain("That gives me the context");
    expect(result.decision.utterance).toContain(questions[1]?.text);
  });

  it("closes immediately and naturally after the final answer", async () => {
    const { service, decide } = harness([questions[0]!]);
    const started = await service.start(setup, "user-1", 1_000);
    decide.mockResolvedValue({
      action: "move_on",
      missing: "none",
      reason: "question answered",
      acknowledgement: "Understood",
      line: ""
    });

    const result = await service.answer(
      started.state.id,
      {
        text: "I owned the resolver and measured a 30 percent drop in conflicts.",
        startMs: 500,
        endMs: 4_000
      },
      6_000
    );

    expect(result.state.phase).toBe("done");
    expect(result.decision.utterance).toContain("Thanks for the conversation");
    expect(result.decision.utterance).not.toContain("What would you like to ask me");
  });

  it("replaces repetitive acknowledgements with varied human bridges", async () => {
    const { service, decide } = harness();
    const started = await service.start(setup, "user-1", 1_000);
    decide.mockResolvedValue({
      action: "move_on",
      missing: "none",
      reason: "answer is complete",
      acknowledgement: "Got it, that makes sense",
      line: ""
    });

    const first = await service.answer(
      started.state.id,
      { text: "I owned the editor sync layer.", startMs: 500, endMs: 2_000 },
      3_000
    );
    const second = await service.answer(
      first.state.id,
      {
        text: "I chose the conflict strategy and measured fewer merge errors.",
        startMs: 3_500,
        endMs: 5_000
      },
      6_000
    );

    expect(first.decision.utterance.toLowerCase()).not.toContain("got it");
    expect(second.decision.utterance.toLowerCase()).not.toContain("got it");
    expect(first.decision.utterance).not.toBe(second.decision.utterance);
  });

  it("removes generic filler embedded in the follow-up line", async () => {
    const { service, decide } = harness();
    const started = await service.start(setup, "user-1", 1_000);
    decide.mockResolvedValue({
      action: "probe",
      missing: "specificity",
      reason: "the answer needs one concrete detail",
      acknowledgement: "",
      line: "Got it. Can you walk me through the specific decision you made?"
    });

    const result = await service.answer(
      started.state.id,
      { text: "I worked on the sync layer.", startMs: 500, endMs: 2_000 },
      3_000
    );

    expect(result.decision.utterance).toBe(
      "Can you walk me through the specific decision you made?"
    );
    expect(result.decision.utterance.toLowerCase()).not.toContain("got it");
  });

  it("records answer evidence and carries it into the next decision", async () => {
    const { service, decide } = harness();
    const started = await service.start(setup, "user-1", 1_000);
    decide
      .mockResolvedValueOnce({
        action: "probe",
        missing: "outcome",
        reason: "impact is missing",
        acknowledgement: "",
        line: "What changed for users?"
      })
      .mockResolvedValue({
        action: "move_on",
        missing: "outcome",
        reason: "ownership and implementation are clear but impact is missing",
        acknowledgement: "",
        line: ""
      });

    const first = await service.answer(
      started.state.id,
      {
        text: "I personally owned the React editor sync and chose Redis because it reduced duplicate updates.",
        startMs: 500,
        endMs: 2_000
      },
      3_000
    );

    const result = await service.answer(
      first.state.id,
      {
        text: "The outcome was a 30 percent reduction in duplicate updates.",
        startMs: 3_500,
        endMs: 5_000
      },
      6_000
    );

    expect(result.state.evidence?.["0"]).toEqual(
      expect.objectContaining({
        ownership: expect.arrayContaining([expect.stringContaining("personally owned")]),
        decision: expect.arrayContaining([expect.stringContaining("chose Redis")]),
        specificity: expect.arrayContaining([expect.stringContaining("React")]),
        gaps: expect.arrayContaining(["outcome"])
      })
    );
    expect(decide).toHaveBeenLastCalledWith(
      expect.objectContaining({
        evidenceLedger: expect.objectContaining({
          ownership: expect.arrayContaining([expect.stringContaining("personally owned")]),
          decision: expect.arrayContaining([expect.stringContaining("chose Redis")]),
          specificity: expect.arrayContaining([expect.stringContaining("React")]),
          gaps: expect.arrayContaining(["outcome"])
        })
      })
    );
  });

  it("speaks only one focused follow-up when the model combines questions", async () => {
    const { service, decide } = harness();
    const started = await service.start(setup, "user-1", 1_000);
    decide.mockResolvedValue({
      action: "probe",
      missing: "outcome",
      reason: "impact is missing",
      acknowledgement: "",
      line: "What changed for users? How did you measure it?"
    });

    const result = await service.answer(
      started.state.id,
      { text: "I shipped the payment flow.", startMs: 500, endMs: 2_000 },
      3_000
    );

    expect(result.decision.utterance).toBe("What changed for users?");
  });

  it("only exposes durable reports to the session owner", async () => {
    const { service } = harness();
    const started = await service.start(setup, "user-1", 1_000);

    await expect(service.history("user-1", 10, 2_000)).resolves.toHaveLength(1);
    await expect(service.history("user-2", 10, 2_000)).resolves.toHaveLength(0);
    await expect(service.report("user-1", started.state.id, 2_000)).resolves.toMatchObject({
      sessionId: started.state.id
    });
    await expect(service.report("user-2", started.state.id, 2_000)).rejects.toMatchObject({
      code: "SESSION_NOT_FOUND"
    });
  });
});
