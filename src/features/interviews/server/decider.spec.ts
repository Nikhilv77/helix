import {
  buildDecidePrompt,
  candidateConversationFallback,
  classifyCandidateTurn,
  InterviewDecider
} from "./decider";
import type { DecideInput } from "./decider";

const input: DecideInput = {
  setup: {
    role: "frontend",
    level: "3-5",
    roundType: "behavioral",
    intensity: "realistic",
    context: "Built a checkout flow.",
    templateId: "resume-behavioral-defense",
    templateTitle: "Resume and Behavioral Defense"
  },
  questionAsked: "What did you personally own in that checkout work?",
  evidenceAnchor: "Checkout flow retry handling",
  competency: "Ownership",
  intent: "Separate personal contribution from team work.",
  mustHit: ["personal responsibility", "specific implementation"],
  userAnswer: "I owned the retry flow and the error states.",
  followUpCount: 0,
  conversationHistory: []
};

describe("resume interview decider prompt", () => {
  it("routes short candidate questions and dialogue repair as conversation", () => {
    expect(classifyCandidateTurn("What do you mean by role?")).toBe("conversation");
    expect(classifyCandidateTurn("Can you rephrase that question?")).toBe("conversation");
    expect(classifyCandidateTurn("How are you doing today?")).toBe("conversation");
    expect(classifyCandidateTurn("I'm a bit nervous, this is my first interview.")).toBe(
      "conversation"
    );
    expect(
      classifyCandidateTurn(
        "I led the migration because our checkout failures had reached twelve percent."
      )
    ).toBe("answer");
  });

  it("requires James to answer a mid-interview clarification before returning", () => {
    const prompt = buildDecidePrompt({
      ...input,
      questionAsked: "Which role or transition was most meaningful to you?",
      userAnswer: "What do you mean by role?",
      candidateTurnMode: "conversation"
    });

    expect(prompt).toContain("You MUST choose respond");
    expect(prompt).toContain("define it plainly");
    expect(prompt).toContain("never ask them to explain what they mean");
    expect(prompt).toContain("return naturally to the still-pending interview question");
  });

  it("recovers the previous candidate question after a dialogue-repair turn", () => {
    expect(
      candidateConversationFallback("I'm asking you.", [
        { speaker: "user", text: "What do you mean by role?" },
        { speaker: "agent", text: "Could you explain what you mean by role?" }
      ])
    ).toBe("By role, I mean a job or position you held and the responsibilities you had.");
  });

  it("overrides a provider that mistakes a candidate clarification for a probe", async () => {
    const generateStructured = vi.fn().mockResolvedValue({
      action: "probe",
      missing: "specificity",
      reason: "mistook the clarification for an answer",
      acknowledgement: "",
      line: "Could you explain what you mean by role?",
      candidateResponse: ""
    });
    const decider = new InterviewDecider({ generateStructured } as never);

    const result = await decider.decide({
      ...input,
      questionAsked: "Which role or transition was most meaningful to you?",
      userAnswer: "What do you mean by role?"
    });

    expect(result.action).toBe("respond");
    expect(result.missing).toBe("none");
    expect(result.candidateResponse).toBe(
      "By role, I mean a job or position you held and the responsibilities you had."
    );
    expect(result.line).toBe("Which role or transition was most meaningful to you?");
  });

  it("asks James to balance natural follow-ups with moving on", () => {
    const prompt = buildDecidePrompt(input);

    expect(prompt).toContain("resume-defense conversation");
    expect(prompt).toContain("Do not counter every answer");
    expect(prompt).toContain("Never manufacture a follow-up");
    expect(prompt).toContain("simple spoken phrasing");
    expect(prompt).toContain("single missing link in this evidence chain");
    expect(prompt).toContain("Checkout flow retry handling");
    expect(prompt).toContain("always provide a brief acknowledgement");
    expect(prompt).toContain("reflect one specific detail or motivation");
    expect(prompt).toContain("React was the entry point for you");
  });

  it("keeps hiring-manager follow-ups behavioural and evidence based", () => {
    const prompt = buildDecidePrompt({
      ...input,
      setup: {
        ...input.setup,
        roundType: "hiring-manager",
        resumeRound: true,
        templateId: "hiring-manager-final",
        templateTitle: "Hiring Manager & Final Behavioural"
      },
      interviewStage: "career",
      maxFollowUps: 3
    });

    expect(prompt).toContain("hiring-manager and behavioural conversation");
    expect(prompt).toContain("normally ask two connected follow-ups");
    expect(prompt).toContain("acknowledge the important detail");
    expect(prompt).toContain("never drift into technical trivia");
    expect(prompt).not.toContain("resume-defense conversation");
  });

  it("uses different human follow-up strategies across HR sections", () => {
    const setup = {
      ...input.setup,
      roundType: "hiring-manager" as const,
      resumeRound: true
    };
    const roleFit = buildDecidePrompt({
      ...input,
      setup,
      interviewStage: "current-role",
      followUpCount: 1,
      maxFollowUps: 2
    });
    const work = buildDecidePrompt({
      ...input,
      setup,
      interviewStage: "project",
      followUpCount: 0,
      maxFollowUps: 2
    });
    const finalConversation = buildDecidePrompt({
      ...input,
      setup,
      interviewStage: "behavioral",
      followUpCount: 0,
      maxFollowUps: 1
    });

    expect(roleFit).toContain("do not ask for a project example");
    expect(roleFit).toContain("realistic trade-off, sacrifice, or deal-breaker");
    expect(work).toContain("personal decision or action");
    expect(work).toContain("credible qualitative outcome");
    expect(finalConversation).toContain("keep the tone warm and lighter");
    expect(finalConversation).toContain("personal ownership, repair, and a concrete change");
  });

  it("lets only the final HR turn answer candidate questions without inventing employer facts", () => {
    const prompt = buildDecidePrompt({
      ...input,
      setup: {
        ...input.setup,
        roundType: "hiring-manager",
        resumeRound: true
      },
      questionAsked: "What would you like to ask me?",
      userAnswer: "What does success look like in this role?",
      interviewStage: "behavioral",
      maxFollowUps: 0,
      acceptsCandidateQuestions: true
    });

    expect(prompt).toContain("final candidate-question turn");
    expect(prompt).toContain("simulated interviewer, not a real employer");
    expect(prompt).toContain("never invent company policies");
    expect(prompt).toContain("put a concise, useful answer in candidateResponse");
  });

  it("gives the interviewer the evidence already established", () => {
    const prompt = buildDecidePrompt({
      ...input,
      evidenceLedger: {
        ownership: ["I owned the retry flow."],
        decision: ["I chose idempotency keys because retries could duplicate charges."],
        specificity: ["The flow used Redis and PayU."],
        outcome: [],
        gaps: ["outcome"]
      }
    });

    expect(prompt).toContain("Personal ownership: I owned the retry flow.");
    expect(prompt).toContain("Decision or trade-off: I chose idempotency keys");
    expect(prompt).toContain("Current gaps: outcome");
    expect(prompt).toContain("do not ask for these again");
  });

  it("bounds personalized follow-ups to the assigned topic and rubric", () => {
    const prompt = buildDecidePrompt({
      ...input,
      maxFollowUps: 3,
      topicLabel: "Laravel",
      blueprintDifficulty: "intermediate",
      rubric: [
        {
          key: "depth",
          label: "Technical depth",
          weightPercent: 100,
          strongSignals: ["Explains the request lifecycle"],
          weakSignals: ["Only names framework features"]
        }
      ],
      followUpPolicy: {
        maxPerQuestion: 3,
        probeWeakClaims: true,
        increaseDifficultyAfterStrongAnswer: true,
        stayWithinBlueprintTopics: true
      }
    });

    expect(prompt).toContain("Assigned topic: Laravel");
    expect(prompt).toContain("Technical depth: strong=Explains the request lifecycle");
    expect(prompt).toContain("Stay within the assigned topic");
    expect(prompt).toContain("0 of 3");
  });

  it("uses authored DSA signals for problem-specific follow-ups without revealing them", () => {
    const prompt = buildDecidePrompt({
      ...input,
      setup: {
        ...input.setup,
        roundType: "technical",
        dsaBlockAssessment: {
          kind: "dsa-block-assessment",
          blockId: "11111111-1111-4111-8111-111111111111",
          assessmentId: "22222222-2222-4222-8222-222222222222",
          snapshotVersion: 2,
          rubricVersion: 1
        }
      },
      questionKind: "code",
      dsaInterviewerGuide: {
        concepts: ["sliding window invariant"],
        strongSignals: ["moves the left edge only when the window is invalid"],
        commonMistakes: ["recomputes the window on every iteration"],
        followUpPrompts: ["What stays true after you move the left pointer?"],
        edgeCases: ["an empty input"]
      }
    });

    expect(prompt).toContain("sliding window invariant");
    expect(prompt).toContain("What stays true after you move the left pointer?");
    expect(prompt).toContain("never as material to reveal");
    expect(prompt).toContain("not personal ownership or business impact");
  });
});
