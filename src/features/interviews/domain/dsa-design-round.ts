/**
 * Durable public identity for System Design sessions and legacy combined
 * DSA/Design sessions. The reviewed answer key and rubric stay in server-only
 * planned-question guides.
 */
export type DsaDesignRoundMetadata = {
  kind: "dsa-design-round";
  version: 1;
  designScenarioKey: string;
  designScenarioVersion: number;
  designScenarioTitle: string;
  designDifficulty: "guided" | "standard" | "stretch";
};

/** The small structural shape safe for domain and UI callers to share. */
export type DsaDesignRoundIdentity = {
  templateId?: string;
  templateTitle?: string;
  dsaQuestionSlugs?: readonly string[];
  dsaDesignRound?: Pick<DsaDesignRoundMetadata, "kind">;
};

/**
 * Shared workspace identity for DSA, System Design, and legacy combined
 * sessions. Use the narrower predicates when round boundaries matter.
 */
export function isDsaDesignRound(setup: DsaDesignRoundIdentity | null | undefined): boolean {
  return isDsaInterviewRound(setup) || isSystemDesignRound(setup);
}

export function isDsaInterviewRound(setup: DsaDesignRoundIdentity | null | undefined): boolean {
  if (!setup) return false;

  const title = setup.templateTitle?.trim().toLowerCase();
  return (
    setup.templateId === "dsa" ||
    Boolean(setup.dsaQuestionSlugs?.length) ||
    title === "dsa practice interview" ||
    title === "dsa interview" ||
    title === "dsa & design interview"
  );
}

export function isSystemDesignRound(setup: DsaDesignRoundIdentity | null | undefined): boolean {
  if (!setup) return false;
  return (
    setup.templateId === "system-design" ||
    setup.dsaDesignRound?.kind === "dsa-design-round" ||
    setup.templateTitle?.trim().toLowerCase() === "system design interview"
  );
}

/** True only for an already-created legacy combined DSA and Design session. */
export function isCombinedDsaDesignRound(
  setup: DsaDesignRoundIdentity | null | undefined
): boolean {
  if (!setup) return false;
  return (
    (setup.templateId === "dsa" && setup.dsaDesignRound?.kind === "dsa-design-round") ||
    setup.templateTitle?.trim().toLowerCase() === "dsa & design interview"
  );
}
