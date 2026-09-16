/**
 * Durable public identity for the permanent DSA & Design round. The metadata
 * deliberately contains only selection/display data: the reviewed scenario's
 * answer key and rubric stay on server-only planned-question guides.
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
 * Recognises both the legacy DSA-only sessions and the new combined sessions.
 * Template ID is the durable primary identity; title/slug checks retain
 * compatibility with sessions saved before it was consistently stamped.
 */
export function isDsaDesignRound(setup: DsaDesignRoundIdentity | null | undefined): boolean {
  if (!setup) return false;

  const title = setup.templateTitle?.trim().toLowerCase();
  return (
    setup.templateId === "dsa" ||
    setup.dsaDesignRound?.kind === "dsa-design-round" ||
    Boolean(setup.dsaQuestionSlugs?.length) ||
    title === "dsa practice interview" ||
    title === "dsa & design interview"
  );
}

/** True only for the new five-question combined round, not legacy DSA-only rooms. */
export function isCombinedDsaDesignRound(
  setup: DsaDesignRoundIdentity | null | undefined
): boolean {
  if (!setup) return false;
  return (
    setup.dsaDesignRound?.kind === "dsa-design-round" ||
    setup.templateTitle?.trim().toLowerCase() === "dsa & design interview"
  );
}
