import { isDsaDesignRound, type DsaDesignRoundMetadata } from "./dsa-design-round";

export type InterviewerPersonaId = "claire" | "james";

const GEMINI_INTERVIEWER_VOICES = {
  claire: "Kore",
  james: "Charon"
} as const satisfies Record<InterviewerPersonaId, string>;

/** One authoritative Gemini voice per reserved interview persona. */
export function geminiVoiceForInterviewer(personaId: InterviewerPersonaId): string {
  return GEMINI_INTERVIEWER_VOICES[personaId];
}

type InterviewPersonaSetup = {
  templateId?: string;
  templateTitle?: string;
  dsaQuestionSlugs?: string[];
  dsaDesignRound?: DsaDesignRoundMetadata;
  dsaBlockAssessment?: { kind: string };
  storyPracticeAssessment?: { practice: string };
  coreTechnicalAssessment?: { kind: string };
};

/**
 * Interview personas are assigned by round, independently of the candidate's
 * everyday practice coach. Claire conducts DSA and Core Technical; James owns
 * every other interview format.
 */
export function interviewerPersonaIdForSetup(
  setup: InterviewPersonaSetup | null | undefined
): InterviewerPersonaId {
  if (!setup) return "james";

  const isDsa =
    setup.dsaBlockAssessment?.kind === "dsa-block-assessment" || isDsaDesignRound(setup);
  const isCoreTechnical =
    setup.storyPracticeAssessment?.practice === "core-technical" ||
    setup.coreTechnicalAssessment?.kind === "core-technical-assessment";

  return isDsa || isCoreTechnical ? "claire" : "james";
}

export function interviewerNameForSetup(
  setup: InterviewPersonaSetup | null | undefined
): "Claire" | "James" {
  return interviewerPersonaIdForSetup(setup) === "claire" ? "Claire" : "James";
}
