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

export function formatTimestamp(value: number): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}
