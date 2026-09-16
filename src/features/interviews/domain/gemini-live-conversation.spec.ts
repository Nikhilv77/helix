import { GEMINI_LED_INTERVIEW_TOOLS, usesGeminiLedConversation } from "./gemini-live-conversation";

describe("Gemini-led interview policy", () => {
  it("allows the reserved conversational interview families", () => {
    expect(
      usesGeminiLedConversation({
        roundType: "hiring-manager",
        resumeRound: true,
        templateId: "hiring-manager-final"
      })
    ).toBe(true);
    expect(
      usesGeminiLedConversation({
        roundType: "behavioral",
        resumeRound: true,
        templateId: "resume-behavioral-defense"
      })
    ).toBe(true);
    expect(
      usesGeminiLedConversation({
        roundType: "technical",
        resumeRound: false,
        templateId: "core-technical"
      })
    ).toBe(false);
    expect(
      usesGeminiLedConversation({
        roundType: "technical",
        resumeRound: false,
        templateId: "dsa",
        templateTitle: "DSA & Design interview",
        dsaQuestionSlugs: ["two-sum"]
      })
    ).toBe(true);
  });

  it("requires Gemini to classify candidate intent by meaning", () => {
    const declaration = GEMINI_LED_INTERVIEW_TOOLS[0]?.functionDeclarations[0];
    const schema = declaration?.parametersJsonSchema as {
      properties?: Record<string, { enum?: string[] }>;
      required?: string[];
    };

    expect(schema.required).toContain("candidateIntent");
    expect(schema.properties?.candidateIntent?.enum).toEqual([
      "answer",
      "decline",
      "end",
      "question-or-clarification",
      "other"
    ]);
  });
});
