type AssessmentPrompt = { id: string };
type AssessmentTurn = {
  speaker: "agent" | "user";
  text: string;
  questionIndex?: number;
};

/** Groups durable user turns by frozen prompt without importing a domain snapshot. */
export function storyPracticeInterviewResponses(
  prompts: readonly AssessmentPrompt[],
  turns: readonly AssessmentTurn[],
  answerMaxLength: number
): Array<{ promptId: string; answer: string }> {
  return prompts.map((prompt, questionIndex) => ({
    promptId: prompt.id,
    answer: boundedAnswer(
      turns
        .filter((turn) => turn.speaker === "user" && turn.questionIndex === questionIndex)
        .map((turn) => turn.text)
        .join("\n\n"),
      answerMaxLength
    )
  }));
}

function boundedAnswer(value: string, maxLength: number): string {
  const normalized = value.trim();
  if (normalized.length <= maxLength) return normalized;
  return normalized.slice(normalized.length - maxLength);
}
