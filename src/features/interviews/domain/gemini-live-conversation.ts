import type { FunctionDeclaration } from "@google/genai";

export const COMPLETE_INTERVIEW_TURN_TOOL = "complete_interview_turn";

/**
 * Gemini owns turn-taking in the hiring-manager room, but it cannot mutate the
 * interview itself. This blocking tool hands the completed candidate turn to
 * Trailgrad and returns the only interview content James may use next.
 */
export const GEMINI_LED_INTERVIEW_TOOLS: Array<{
  functionDeclarations: FunctionDeclaration[];
}> = [
  {
    functionDeclarations: [
      {
        name: COMPLETE_INTERVIEW_TURN_TOOL,
        description:
          "Call exactly once after each complete candidate utterance, before replying. This saves the turn and gets the server-approved interview direction. Use it for answers, clarification requests, candidate questions, and requests to end the interview.",
        parametersJsonSchema: {
          type: "object",
          properties: {
            answerText: {
              type: "string",
              description:
                "A verbatim transcript of the candidate's complete latest utterance. Do not summarize, correct, or add words."
            },
            action: {
              type: "string",
              enum: ["clarify", "probe", "challenge", "respond", "move_on"],
              description:
                "Choose respond for a candidate question or clarification, move_on when evidence is sufficient, otherwise one focused follow-up."
            },
            missing: {
              type: "string",
              enum: ["clarity", "structure", "specificity", "ownership", "outcome", "none"]
            },
            acknowledgement: {
              type: "string",
              description:
                "A brief, non-evaluative acknowledgement grounded in the candidate's words. Empty for clarify or respond."
            },
            line: {
              type: "string",
              description:
                "Exactly one concise follow-up for clarify, probe, challenge, or respond. Empty when moving on."
            },
            candidateResponse: {
              type: "string",
              description:
                "A brief answer only when the candidate asked a question. Never invent employer facts. Otherwise empty."
            },
            reason: {
              type: "string",
              description: "One short internal reason for the action. Never say this aloud."
            }
          },
          required: [
            "answerText",
            "action",
            "missing",
            "acknowledgement",
            "line",
            "candidateResponse",
            "reason"
          ],
          additionalProperties: false
        }
      }
    ]
  }
];
