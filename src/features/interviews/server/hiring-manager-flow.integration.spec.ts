import { randomUUID } from "node:crypto";
import type { CandidateResume } from "@/lib/shared/types";
import { buildOpeningUtterance } from "@/app/api/interview/gemini-live/token/route";
import { InterviewDecider } from "./decider";
import { buildHiringManagerPlan, hiringManagerRoundContext } from "./hiring-manager-round";
import { InterviewService } from "./interview.service";
import { InterviewPlanner } from "./planner";
import { MemorySessionStore } from "./session-store";
import type { InterviewSetup } from "./types";

const OWNER_ID = "user:integration";
const STARTED_AT = 1_000_000;
const resume = {
  experience: [{ role: "Senior Engineer", organization: "Northstar" }],
  projects: [{ name: "Ledger Guard" }]
} as CandidateResume;
const personalization = {
  resume,
  targetRole: "backend" as const,
  targetCompany: "Acme"
};

function harness() {
  const plan = buildHiringManagerPlan(personalization);
  const planner = { plan: vi.fn().mockResolvedValue(plan) } as unknown as InterviewPlanner;
  const decide = vi.fn().mockImplementation(async (input) => ({
    action: "move_on" as const,
    missing: "none" as const,
    reason: "complete answer",
    acknowledgement: input.acceptsCandidateQuestions ? "That is a useful question" : "",
    line: "",
    candidateResponse: input.acceptsCandidateQuestions
      ? "Success means taking clear ownership, communicating trade-offs early, and helping the team deliver reliably."
      : ""
  }));
  const service = new InterviewService(
    planner,
    { decide } as unknown as InterviewDecider,
    new MemorySessionStore(),
    20
  );
  const setup: InterviewSetup = {
    role: "backend",
    level: "3-5",
    roundType: "hiring-manager",
    intensity: "realistic",
    context: hiringManagerRoundContext(personalization),
    agenda: plan.map((question) => question.text),
    templateId: "hiring-manager-final",
    templateTitle: "Hiring Manager & Final Behavioural",
    resumeRound: true
  };

  return { service, plan, setup, decide };
}

describe("Hiring Manager start → voice transcript → close → report", () => {
  it("carries a personalized frozen plan through the final candidate question into its report", async () => {
    const { service, plan, setup, decide } = harness();
    const started = await service.start(setup, OWNER_ID, STARTED_AT, plan);
    const voiceOpening = buildOpeningUtterance({
      isHiringManagerRound: true,
      question: started.state.plan[0]!.text
    });

    expect(started.utterance).toContain("Senior Engineer at Northstar");
    expect(voiceOpening).toContain(started.state.plan[0]!.text);
    expect(started.state.plan[1]?.text).toContain("Backend Engineer role at Acme");
    expect(started.state.plan[2]?.text).toContain("Ledger Guard");

    let finalUtterance = "";
    for (let index = 0; index < plan.length; index += 1) {
      const isFinal = index === plan.length - 1;
      const answer = isFinal
        ? "I value direct feedback and clear ownership. What does success look like in this role?"
        : `I personally owned example ${index + 1}, chose the approach because of the trade-off, and improved the result by 20%.`;
      const at = STARTED_AT + (index + 1) * 2 * 60 * 1000;
      const result = await service.answerOwned(
        OWNER_ID,
        started.state.id,
        { text: answer, startMs: at - STARTED_AT - 45_000, endMs: at - STARTED_AT },
        at,
        randomUUID()
      );
      finalUtterance = result.decision.utterance;
    }

    expect(decide).toHaveBeenCalledTimes(8);
    expect(decide).toHaveBeenLastCalledWith(
      expect.objectContaining({ acceptsCandidateQuestions: true })
    );
    expect(finalUtterance).toContain("Speaking generally for this simulation");
    expect(finalUtterance).toContain("Success means taking clear ownership");
    expect(finalUtterance).toContain("Thanks for the conversation");

    const report = await service.report(OWNER_ID, started.state.id, STARTED_AT + 17 * 60 * 1000);
    expect(report).toMatchObject({
      status: "completed",
      questionCount: 8,
      questionsCovered: 8,
      answerCount: 8
    });
    expect(report.transcript.at(-2)?.text).toContain("What does success look like");
    expect(report.transcript.at(-1)?.text).toContain("Success means taking clear ownership");
  });

  it("drops support prompts for a slow voice interview but still reaches every protected section", async () => {
    const { service, plan, setup } = harness();
    const started = await service.start(setup, OWNER_ID, STARTED_AT, plan);
    const answerAtMinute = async (minute: number, text: string) =>
      service.answerOwned(
        OWNER_ID,
        started.state.id,
        { text, startMs: minute * 60_000 - 30_000, endMs: minute * 60_000 },
        STARTED_AT + minute * 60_000,
        randomUUID()
      );

    await answerAtMinute(5, "I owned my career choices and can explain the outcomes.");
    await answerAtMinute(10, "I want the backend role because it matches the work I enjoy.");
    const work = await answerAtMinute(
      20,
      "I personally led Ledger Guard, chose the design because reliability mattered, and improved results."
    );
    expect(work.state.questionIndex).toBe(5);
    expect(work.state.skippedQuestionIndexes).toEqual([3, 4]);

    const finalConversation = await answerAtMinute(
      23,
      "I took responsibility for the incident, repaired it, and changed our release checklist."
    );
    expect(finalConversation.state.questionIndex).toBe(7);
    expect(finalConversation.state.skippedQuestionIndexes).toEqual([3, 4, 6]);

    const closed = await answerAtMinute(
      25,
      "I value candid feedback. What does success look like in this role?"
    );
    expect(closed.state.phase).toBe("done");

    const report = await service.report(OWNER_ID, started.state.id, STARTED_AT + 26 * 60 * 1000);
    expect(report.status).toBe("completed");
    expect(report.questionsCovered).toBe(5);
    expect(
      plan
        .map((question, index) => ({ question, index }))
        .filter(({ question }) => question.requiredForPacing)
        .every(({ index }) => report.competencies[index]?.answered)
    ).toBe(true);
  });
});
