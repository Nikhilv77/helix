import type { FunctionDeclaration } from "@google/genai";
import type { InterviewSetup } from "@/features/interviews/server/types";
import { isCombinedDsaDesignRound } from "./dsa-design-round";

export const COMPLETE_INTERVIEW_TURN_TOOL = "complete_interview_turn";

/**
 * Gemini owns turn-taking in selected conversational rooms, but it cannot mutate the
 * interview itself. This blocking tool hands the completed candidate turn to
 * Trailgrad and returns the only interview content the interviewer may use next.
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
            candidateIntent: {
              type: "string",
              enum: ["answer", "decline", "end", "question-or-clarification", "other"],
              description:
                "Classify the candidate's communicative intent by meaning, not exact wording. Use decline when they refuse this question or cannot/will not answer it; end only when they explicitly want to end the whole interview; question-or-clarification when they ask the interviewer something; answer for an attempted answer; otherwise other."
            },
            action: {
              type: "string",
              enum: ["clarify", "probe", "challenge", "respond", "move_on"],
              description:
                "Choose respond for a candidate question or clarification. Choose move_on only when credible evidence is sufficient, not merely specific. Choose challenge for concerning professional conduct, a concrete inconsistency, or missing accountability; otherwise use one focused probe."
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
            "candidateIntent",
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

/** Canonical allow-list for interview families where Gemini owns the dialogue. */
export function usesGeminiLedConversation(
  setup: Pick<
    InterviewSetup,
    | "roundType"
    | "templateId"
    | "resumeRound"
    | "templateTitle"
    | "dsaQuestionSlugs"
    | "dsaDesignRound"
  >
): boolean {
  return (
    setup.templateId === "hiring-manager-final" ||
    setup.templateId === "resume-behavioral-defense" ||
    (setup.roundType === "hiring-manager" && setup.resumeRound === true) ||
    isCombinedDsaDesignRound(setup)
  );
}
