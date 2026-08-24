import { fundamentalsQuestions } from "@/lib/fundamentals/fundamentals";
import {
  EXPLAIN_QUESTIONS,
  FUNDAMENTALS_QUESTION_COUNT,
  RAPID_QUESTIONS,
  buildFundamentalsPlan
} from "./fundamentals-round";
import { gradeMultipleChoice, multipleChoiceReply } from "./resume-round";

const inOrder = <T,>(items: T[]) => items;

describe("fundamentals question bank", () => {
  const questions = fundamentalsQuestions();

  it("has no duplicate slugs", () => {
    const slugs = questions.map((question) => question.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("gives every multiple choice question four options and a valid answer", () => {
    for (const question of questions.filter((item) => item.format === "mcq")) {
      expect(question.options).toHaveLength(4);
      expect(question.answerIndex).toBeGreaterThanOrEqual(0);
      expect(question.answerIndex).toBeLessThan(question.options.length);
      expect(question.explanation).not.toBe("");
    }
  });

  it("gives every spoken question expectations and a probe", () => {
    for (const question of questions.filter((item) => item.format !== "mcq")) {
      expect(question.expects.length).toBeGreaterThanOrEqual(2);
      expect(question.probeIfMissing).not.toBe("");
    }
  });

  it("gives every question a concept card to teach from", () => {
    for (const question of questions) {
      expect(question.concept.title).not.toBe("");
      expect(question.concept.summary).not.toBe("");
      expect(question.concept.points.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("holds enough of each format to build a round without repeating", () => {
    const byFormat = (format: string) =>
      questions.filter((question) => question.format === format).length;

    expect(byFormat("mcq")).toBeGreaterThanOrEqual(RAPID_QUESTIONS);
    expect(byFormat("explain")).toBeGreaterThanOrEqual(EXPLAIN_QUESTIONS);
    expect(byFormat("scenario")).toBeGreaterThanOrEqual(1);
  });
});

describe("buildFundamentalsPlan", () => {
  it("runs rapid fire, then explain, then scenario", () => {
    const plan = buildFundamentalsPlan("3-5", { shuffle: inOrder });

    expect(plan).toHaveLength(FUNDAMENTALS_QUESTION_COUNT);
    expect(plan.map((question) => question.stage)).toEqual([
      "rapid",
      "rapid",
      "rapid",
      "rapid",
      "rapid",
      "explain",
      "explain",
      "explain",
      "scenario"
    ]);
  });

  it("makes the rapid stage multiple choice and the rest spoken", () => {
    const plan = buildFundamentalsPlan("3-5", { shuffle: inOrder });
    const rapid = plan.filter((question) => question.stage === "rapid");
    const spoken = plan.filter((question) => question.stage !== "rapid");

    expect(rapid.every((question) => question.kind === "mcq")).toBe(true);
    expect(rapid.every((question) => (question.options?.length ?? 0) === 4)).toBe(true);
    expect(spoken.every((question) => question.answerFormat === "spoken")).toBe(true);
    expect(spoken.every((question) => !question.options)).toBe(true);
  });

  it("spreads the rapid stage across areas instead of repeating one", () => {
    const plan = buildFundamentalsPlan("3-5", { shuffle: inOrder });
    const areas = plan
      .filter((question) => question.stage === "rapid")
      .map((question) => question.evidenceAnchor);

    expect(new Set(areas).size).toBeGreaterThanOrEqual(3);
  });

  it("never asks the same question twice in one round", () => {
    const plan = buildFundamentalsPlan("3-5", { shuffle: inOrder });
    const slugs = plan.map((question) => question.sourceSlug);

    expect(new Set(slugs).size).toBe(plan.length);
  });

  it("carries the bank slug so the room can show the concept card", () => {
    const plan = buildFundamentalsPlan("3-5", { shuffle: inOrder });

    expect(plan.every((question) => Boolean(question.sourceSlug))).toBe(true);
  });

  it("still fills a round for a fresher, whose pool is smaller", () => {
    const plan = buildFundamentalsPlan("fresher", { shuffle: inOrder });

    expect(plan).toHaveLength(FUNDAMENTALS_QUESTION_COUNT);
    expect(new Set(plan.map((question) => question.sourceSlug)).size).toBe(plan.length);
  });

  it("varies the round between runs", () => {
    const forward = buildFundamentalsPlan("3-5", { shuffle: inOrder });
    const reversed = buildFundamentalsPlan("3-5", {
      shuffle: (items) => [...items].reverse()
    });

    expect(reversed.map((q) => q.sourceSlug)).not.toEqual(forward.map((q) => q.sourceSlug));
  });

  it("produces questions the free grader can score", () => {
    const plan = buildFundamentalsPlan("3-5", { shuffle: inOrder });
    const first = plan[0]!;
    const answer = first.options![first.answerIndex!]!;

    expect(gradeMultipleChoice(first, answer)).toMatchObject({ correct: true });
    expect(multipleChoiceReply(first, true)).toContain("That's right");
    // A spoken question has nothing to grade and must fall through to the decider.
    expect(gradeMultipleChoice(plan[5]!, "anything")).toBeNull();
  });
});
