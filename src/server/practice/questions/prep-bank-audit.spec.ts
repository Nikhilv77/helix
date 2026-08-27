import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { auditPrepQuestionBank, PREP_BANK_MINIMUMS } from "./prep-bank-audit";
import { normalizePrepQuestion, type PrepQuestionRecord } from "./prep-question-adapter";

describe("prep question publication", () => {
  it("accepts a complete multi-session bank and rejects missing coverage", () => {
    const complete = Object.entries(PREP_BANK_MINIMUMS).flatMap(([sessionKey, minimum]) =>
      Array.from({ length: minimum.questions }, (_, index) =>
        question(`${sessionKey}-${index}`, sessionKey, `chapter-${index % minimum.chapters}`)
      )
    );

    expect(auditPrepQuestionBank(complete)).toMatchObject({ errors: [] });
    expect(auditPrepQuestionBank(complete.slice(1)).errors).toContain(
      "core-technical: 11 published questions; requires 12"
    );
  });

  it("never exposes the private answer key through the normalized contract", () => {
    const source = question("mcq-question", "core-technical", "chapter-1");
    source.format = "mcq";
    source.answerKey = { correctOptionIndex: 1, options: ["wrong", "right"] };

    const normalized = normalizePrepQuestion(source);

    expect(JSON.stringify(normalized)).not.toContain("correctOptionIndex");
    expect(normalized.evaluation.authoredTestCount).toBe(1);
  });

  it("keeps every source-authored PREP question versioned with progressive coaching", () => {
    const prepDirectory = join(process.cwd(), "src/data/prep");
    const banks = readdirSync(prepDirectory)
      .filter((file) => file.endsWith(".json"))
      .sort()
      .map(
        (file) =>
          JSON.parse(readFileSync(join(prepDirectory, file), "utf8")) as {
            templates: Array<{
              id: string;
              contentVersion?: number;
              hints?: string[];
              explanation?: string;
            }>;
          }
      );

    const failures = banks.flatMap((bank) =>
      bank.templates.flatMap((template) => {
        const hints = template.hints ?? [];
        const uniqueHints = new Set(hints.map((hint) => hint.trim().toLowerCase()));
        const valid =
          Number.isInteger(template.contentVersion) &&
          (template.contentVersion ?? 0) >= 1 &&
          hints.length >= 2 &&
          uniqueHints.size === hints.length &&
          hints.every((hint) => hint.trim().length >= 20) &&
          (template.explanation?.trim().length ?? 0) >= 80;
        return valid ? [] : [template.id];
      })
    );

    expect(failures).toEqual([]);
  });

  it("keeps every fundamentals question structurally teachable before adaptation", () => {
    const fundamentalsDirectory = join(process.cwd(), "src/data/fundamentals");
    const areas = readdirSync(fundamentalsDirectory)
      .filter((file) => file.endsWith(".json"))
      .sort()
      .map(
        (file) =>
          JSON.parse(readFileSync(join(fundamentalsDirectory, file), "utf8")) as {
            questions: Array<{
              slug: string;
              contentVersion?: number;
              format: "mcq" | "explain" | "scenario";
              options?: string[];
              answerIndex?: number;
              explanation?: string;
              expects?: string[];
              concept: { summary: string; points: string[] };
            }>;
          }
      );

    const failures = areas.flatMap((area) =>
      area.questions.flatMap((question) => {
        const uniquePoints = new Set(
          question.concept.points.map((point) => point.trim().toLowerCase())
        );
        const validVersion =
          question.contentVersion === undefined ||
          (Number.isInteger(question.contentVersion) && question.contentVersion >= 1);
        const validMcq =
          question.format !== "mcq" ||
          (Array.isArray(question.options) &&
            question.options.length >= 3 &&
            Number.isInteger(question.answerIndex) &&
            (question.answerIndex ?? -1) >= 0 &&
            (question.answerIndex ?? -1) < question.options.length &&
            (question.explanation?.trim().length ?? 0) >= 40);
        const validOpenAnswer = question.format === "mcq" || (question.expects?.length ?? 0) >= 2;
        const valid =
          validVersion &&
          validMcq &&
          validOpenAnswer &&
          question.concept.summary.trim().length >= 30 &&
          question.concept.points.length >= 3 &&
          uniquePoints.size === question.concept.points.length &&
          question.concept.points.every((point) => point.trim().length >= 20);
        return valid ? [] : [question.slug];
      })
    );

    expect(failures).toEqual([]);
  });
});

function question(
  id: string,
  sessionKey: string,
  chapterKey: string
): PrepQuestionRecord & { publicationStatus: string } {
  return {
    id,
    contentVersion: 1,
    bank: "test-bank",
    sessionKey,
    chapterKey,
    category: "test",
    title: `Question ${id}`,
    roles: ["fullstack"],
    levels: ["3-5"],
    difficulty: "medium",
    expectedMinutes: 8,
    competency: "testing",
    format: "typed",
    prompt: "Explain the mechanism, trade-offs, and failure handling in this engineering scenario.",
    objective: "Demonstrate precise technical reasoning with a concrete example.",
    prerequisites: [],
    tags: ["test"],
    hints: [
      "Begin with the underlying mechanism.",
      "Then connect it to the user-visible consequence."
    ],
    explanation:
      "A strong response explains the mechanism, evaluates trade-offs, and tests the failure path.",
    whatItTests: ["technical reasoning"],
    goodAnswerSignals: ["Explains the mechanism", "Names a concrete trade-off"],
    weakAnswerSignals: ["Only names a tool", "Ignores failure behavior"],
    followUpPrompts: [],
    answerStructure: { steps: ["mechanism", "trade-off", "example"] },
    answerKey: null,
    publicationStatus: "PUBLISHED"
  } satisfies PrepQuestionRecord & { publicationStatus: string };
}
