import type { ResumeInterviewKit } from "@/lib/shared/types";
import {
  buildResumePlan,
  gradeMultipleChoice,
  multipleChoiceReply
} from "./resume-round";

const kit: ResumeInterviewKit = {
  skillQuestions: [
    {
      skill: "React",
      competency: "Technical depth",
      format: "mcq",
      prompt: "Which hook keeps a value stable between renders without causing one?",
      options: ["useState", "useRef", "useMemo", "useEffect"],
      answerIndex: 1,
      explanation: "useRef holds a mutable value that survives renders without re-rendering.",
      expects: ["names useRef", "explains the render behaviour"]
    },
    {
      skill: "TypeScript",
      competency: "Technical depth",
      format: "typed",
      prompt: "How do you type a function that narrows its own argument?",
      options: [],
      answerIndex: 0,
      explanation: "",
      expects: ["mentions a type predicate", "shows the narrowing"]
    },
    {
      skill: "PostgreSQL",
      competency: "Technical depth",
      format: "spoken",
      prompt: "When did an index actually change a query's behaviour for you?",
      options: [],
      answerIndex: 0,
      explanation: "",
      expects: ["a real query", "what changed"]
    },
    {
      skill: "Node",
      competency: "Technical depth",
      format: "mcq",
      prompt: "What runs first after the current operation completes?",
      options: ["setTimeout", "process.nextTick", "setImmediate", "setInterval"],
      answerIndex: 1,
      explanation: "nextTick callbacks drain before the event loop continues.",
      expects: ["names nextTick"]
    }
  ],
  codingTask: {
    skill: "React",
    language: "javascript",
    title: "Debounce a search input",
    brief: "Write a debounce helper and use it to delay the search request.",
    starterCode: "function debounce(fn, wait) {\n  // your code\n}",
    expects: ["clears the previous timer", "preserves arguments"]
  },
  experienceQuestions: [
    {
      prompt: "What did you personally own on the billing rewrite?",
      evidenceAnchor: "Billing rewrite at Acme",
      competency: "Ownership",
      expects: ["their own scope", "what they decided"],
      probeIfMissing: "Which part would not have shipped without you?"
    },
    {
      prompt: "Which billing decision was hardest to reverse?",
      evidenceAnchor: "Billing rewrite at Acme",
      competency: "Technical judgement",
      expects: ["the decision", "the cost"],
      probeIfMissing: "What did you reject, and why?"
    },
    {
      prompt: "What changed for customers after the rewrite?",
      evidenceAnchor: "Billing rewrite at Acme",
      competency: "Impact",
      expects: ["a measurable result"],
      probeIfMissing: "How did you know it worked?"
    }
  ]
};

describe("buildResumePlan", () => {
  it("lays the round out as skills, then code, then experience", () => {
    const plan = buildResumePlan(kit, { shuffle: (items) => items });

    expect(plan).toHaveLength(8);
    expect(plan.map((question) => question.stage)).toEqual([
      "skills",
      "skills",
      "skills",
      "skills",
      "code",
      "experience",
      "experience",
      "experience"
    ]);
  });

  it("carries the option set and the graded answer on multiple choice questions", () => {
    const plan = buildResumePlan(kit, { shuffle: (items) => items });

    expect(plan[0]).toMatchObject({
      kind: "mcq",
      answerFormat: "mcq",
      skill: "React",
      answerIndex: 1
    });
    expect(plan[0]?.options).toEqual(["useState", "useRef", "useMemo", "useEffect"]);
    // A written question has nothing to click, so it carries no options.
    expect(plan[1]).toMatchObject({ kind: "conversation", answerFormat: "typed" });
    expect(plan[1]?.options).toBeUndefined();
  });

  it("turns the coding task into a code question with its starter code", () => {
    const plan = buildResumePlan(kit, { shuffle: (items) => items });
    const code = plan.find((question) => question.stage === "code");

    expect(code).toMatchObject({ kind: "code", language: "javascript" });
    expect(code?.codeTask).toContain("debounce helper");
    expect(code?.codeSnippet).toContain("function debounce");
  });

  it("anchors every experience question to the resume", () => {
    const plan = buildResumePlan(kit, { shuffle: (items) => items });
    const experience = plan.filter((question) => question.stage === "experience");

    expect(experience).toHaveLength(3);
    expect(experience.every((question) => question.evidenceAnchor === "Billing rewrite at Acme")).toBe(
      true
    );
  });

  it("varies the skills asked between rounds", () => {
    const reversed = buildResumePlan(kit, { shuffle: (items) => [...items].reverse() });

    expect(reversed[0]?.skill).toBe("Node");
  });

  it("still builds a round when the resume produced no coding task", () => {
    const plan = buildResumePlan(
      { ...kit, codingTask: null },
      { shuffle: (items) => items }
    );

    expect(plan.some((question) => question.stage === "code")).toBe(false);
    expect(plan).toHaveLength(7);
  });
});

describe("gradeMultipleChoice", () => {
  const [question] = buildResumePlan(kit, { shuffle: (items) => items });

  it("accepts the stored answer without a model call", () => {
    expect(gradeMultipleChoice(question!, "useRef")).toEqual({ correct: true, chosen: "useRef" });
  });

  it("rejects any other option", () => {
    expect(gradeMultipleChoice(question!, "useMemo")).toEqual({ correct: false, chosen: "useMemo" });
  });

  it("ignores case and surrounding space", () => {
    expect(gradeMultipleChoice(question!, "  USEREF ")?.correct).toBe(true);
  });

  it("reports an answer that matches no option", () => {
    expect(gradeMultipleChoice(question!, "something else")).toEqual({
      correct: false,
      chosen: null
    });
  });

  it("does not apply to spoken or written questions", () => {
    const spoken = buildResumePlan(kit, { shuffle: (items) => items })[1];
    expect(gradeMultipleChoice(spoken!, "anything")).toBeNull();
  });
});

describe("multipleChoiceReply", () => {
  const [question] = buildResumePlan(kit, { shuffle: (items) => items });

  it("confirms a correct answer with the stored explanation", () => {
    expect(multipleChoiceReply(question!, true)).toBe(
      "That's right. useRef holds a mutable value that survives renders without re-rendering."
    );
  });

  it("names the right option after a wrong answer", () => {
    expect(multipleChoiceReply(question!, false)).toContain("it's useRef");
  });
});
