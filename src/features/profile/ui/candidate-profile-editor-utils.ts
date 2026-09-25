import type { CandidateProfile, CandidateProfileInput } from "@/lib/shared/types";

/* ----------------------------------------------------------------- helpers */

export function toInput(profile: CandidateProfile): CandidateProfileInput {
  const {
    targetRole,
    level,
    targetCompany,
    targetDate,
    headline,
    context,
    focusAreas,
    stories,
    coverImage,
    profileImage
  } = profile;
  return {
    targetRole,
    level,
    targetCompany,
    targetDate,
    headline,
    context,
    focusAreas,
    stories,
    coverImage,
    profileImage
  };
}
