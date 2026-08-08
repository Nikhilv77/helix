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
