import { describe, expect, it, vi } from "vitest";
import { PrepPracticeEvaluator } from "./prep-practice-evaluator";
import { loadPrepTemplates } from "./questions/load-prep-templates";
import { predictRunSnippet } from "@/lib/practice/predict-run";
import { findTheFlawSnippet } from "@/lib/practice/find-the-flaw";
import { diagnoseArtifact } from "@/lib/practice/diagnose";

/**
 * End-to-end check of every Practice format against real bank content, with no
 * database and no browser.
 *
 * Each format is exercised the way a submission actually travels: a real
 * authored question, a real answer, through the real evaluator, producing the
 * review the workspace renders. What this cannot check is layout — that still
 * needs eyes on a screen.
 *
 * The two properties worth failing over:
 *
 *   1. A correct answer scores, and a wrong one does not.
 *   2. Nothing that reaches the browser before submission contains the answer.
 */

interface Template {
  id: string;
  title: string;
  format?: string;
  prompt: string;
  objective: string;
  difficulty: string;
  evidenceType: string;
  competency: string;
  explanation: string;
  answerKey?: unknown;
  scoringRubric?: unknown;
  answerStructure?: unknown;
  whatItTests: string[];
  goodAnswerSignals: string[];
  weakAnswerSignals: string[];
}

const evaluable = (t: Template) => ({
  id: t.id,
  contentVersion: 1,
  title: t.title,
  format: t.format ?? "typed",
  prompt: t.prompt,
  objective: t.objective,
  difficulty: t.difficulty,
  evidenceType: t.evidenceType,
  competency: t.competency,
  explanation: t.explanation,
  answerKey: t.answerKey,
  scoringRubric: t.scoringRubric,
  answerStructure: t.answerStructure,
  whatItTests: t.whatItTests,
  goodAnswerSignals: t.goodAnswerSignals,
  weakAnswerSignals: t.weakAnswerSignals
});

/** The model is never called on the deterministic paths; this proves it. */
function evaluatorWithSpy() {
  const generateStructured = vi.fn();
  const evaluator = new PrepPracticeEvaluator({ generateStructured } as never);
  return { evaluator, generateStructured };
}

const predictRun = loadPrepTemplates<Template>("predict-run");
const findTheFlaw = loadPrepTemplates<Template>("find-the-flaw");
const diagnose = loadPrepTemplates<Template>("diagnose");

describe("predict-run submits end to end", () => {
  it("has questions to test", () => {
    expect(predictRun.length).toBeGreaterThanOrEqual(10);
  });

  it("marks the authored output correct without calling the model", async () => {
    const { evaluator, generateStructured } = evaluatorWithSpy();
    for (const template of predictRun) {
      const key = template.answerKey as { expectedStdout: string };
      const review = await evaluator.evaluate(evaluable(template), {
        answer: key.expectedStdout,
        selectedOptionIndex: null
      });
      expect(review.correctness, template.id).toBe("correct");
      expect(review.score, template.id).toBe(1);
      expect(review.verificationStatus, template.id).toBe("VERIFIED");
    }
    expect(generateStructured).not.toHaveBeenCalled();
  });

  it("marks a reordered output wrong — order is the thing being tested", async () => {
    const { evaluator } = evaluatorWithSpy();
    const multiline = predictRun.find((t) => {
      const key = t.answerKey as { expectedStdout: string };
      return key.expectedStdout.split("\n").filter(Boolean).length > 1;
    });
    expect(multiline).toBeDefined();

    const key = multiline!.answerKey as { expectedStdout: string };
    const reversed = key.expectedStdout.split("\n").reverse().join("\n");
    const review = await evaluator.evaluate(evaluable(multiline!), {
      answer: reversed,
      selectedOptionIndex: null
    });
    expect(review.correctness).toBe("incorrect");
  });

  it("reveals the real output only in the review", async () => {
    const { evaluator } = evaluatorWithSpy();
    const template = predictRun[0]!;
    const key = template.answerKey as { expectedStdout: string; code: string };

    // Before submitting, the client receives this and nothing more.
    //
    // Note this format cannot hide its answer the way the others do — the code
    // prints the output, so deriving it is the exercise. What must not ship is
    // the authored `expectedStdout` field itself, which would let the page
    // compare without the candidate reasoning at all.
    const snippet = predictRunSnippet(template.answerKey);
    expect(snippet).toEqual({ code: key.code, language: "javascript" });
    expect(Object.keys(snippet!)).toEqual(["code", "language"]);

    const review = await evaluator.evaluate(evaluable(template), {
      answer: "definitely wrong",
      selectedOptionIndex: null
    });
    expect(review.expectedOutput).toBe(key.expectedStdout);
  });
});

describe("find-the-flaw submits end to end", () => {
  it("has questions to test", () => {
    expect(findTheFlaw.length).toBeGreaterThanOrEqual(40);
  });

  it("sends the planted defect to the grader, never to the candidate", async () => {
    const template = findTheFlaw[0]!;
    const key = template.answerKey as { flaw: string; code: string };

    const snippet = findTheFlawSnippet(template.answerKey);
    expect(snippet).toEqual({ code: key.code, language: "javascript" });
    expect(JSON.stringify(snippet)).not.toContain(key.flaw);

    const generateStructured = vi.fn().mockResolvedValue({
      score: 88,
      verdict: "strong",
      summary: "Identified the planted defect.",
      strengths: ["named the mechanism"],
      gaps: [],
      rubricRationale: "The planted defect was identified."
    });
    const evaluator = new PrepPracticeEvaluator({ generateStructured } as never);

    const review = await evaluator.evaluate(evaluable(template), {
      answer: "The author lookup runs inside the loop.",
      selectedOptionIndex: null
    });

    // The grader is told the answer — that is what makes this reliable.
    const prompt = generateStructured.mock.calls[0]![0]!.prompt as string;
    expect(prompt).toContain(key.flaw);
    expect(review.flaw?.summary).toBe(key.flaw);
  });

  it("returns an unverified review rather than marking a candidate wrong on a broken key", async () => {
    const { evaluator } = evaluatorWithSpy();
    const broken = { ...findTheFlaw[0]!, format: "predict-run", answerKey: { nonsense: true } };
    const review = await evaluator.evaluate(evaluable(broken), {
      answer: "anything",
      selectedOptionIndex: null
    });
    expect(review.correctness).toBe("unverified");
    expect(review.score).toBeNull();
  });
});

describe("diagnose submits end to end", () => {
  it("has questions to test", () => {
    expect(diagnose.length).toBeGreaterThanOrEqual(12);
  });

  it("sends the root cause to the grader, never to the candidate", async () => {
    const template = diagnose[0]!;
    const key = template.answerKey as {
      rootCause: string;
      body: string;
      symptom: string;
      acceptableFixes: string[];
    };

    const artifact = diagnoseArtifact(template.answerKey);
    expect(artifact?.body).toBe(key.body);
    expect(artifact?.symptom).toBe(key.symptom);
    expect(JSON.stringify(artifact)).not.toContain(key.rootCause);

    const generateStructured = vi.fn().mockResolvedValue({
      score: 90,
      verdict: "strong",
      summary: "Reached the root cause.",
      strengths: ["read the plan"],
      gaps: [],
      rubricRationale: "The root cause was reached."
    });
    const evaluator = new PrepPracticeEvaluator({ generateStructured } as never);

    const review = await evaluator.evaluate(evaluable(template), {
      answer: "There is no index on the filtered columns.",
      selectedOptionIndex: null
    });

    const prompt = generateStructured.mock.calls[0]![0]!.prompt as string;
    expect(prompt).toContain(key.rootCause);
    for (const fix of key.acceptableFixes) expect(prompt).toContain(fix);
    expect(review.diagnosis?.rootCause).toBe(key.rootCause);
  });
});

describe("no format leaks its answer to the client", () => {
  it("holds across the entire bank", () => {
    // predict-run is excluded by design: its answer is what the code prints,
    // so the code necessarily contains it. The field must still not ship.
    for (const template of predictRun) {
      expect(Object.keys(predictRunSnippet(template.answerKey)!), template.id).toEqual([
        "code",
        "language"
      ]);
    }
    for (const template of findTheFlaw) {
      const key = template.answerKey as { flaw: string };
      expect(JSON.stringify(findTheFlawSnippet(template.answerKey)), template.id).not.toContain(
        key.flaw
      );
    }
    for (const template of diagnose) {
      const key = template.answerKey as { rootCause: string };
      expect(JSON.stringify(diagnoseArtifact(template.answerKey)), template.id).not.toContain(
        key.rootCause
      );
    }
  });
});
