import type { Prisma } from "@prisma/client";

import type { HelpHistoryParticipant } from "@/lib/help/help-history";

export interface HelpParticipantProfile {
  headline: string | null;
  profileImage: string | null;
  resumeAnalysis: Prisma.JsonValue | null;
}

/** Public identity used across peer-help surfaces. */
export function presentHelpParticipant(
  profile: HelpParticipantProfile | null | undefined
): HelpHistoryParticipant {
  return {
    label: profileName(profile?.resumeAnalysis) ?? "Trailgrad candidate",
    headline: profile?.headline ?? null,
    profileImage: profile?.profileImage ?? null
  };
}

function profileName(value: Prisma.JsonValue | null | undefined): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const fullName = value.fullName;
  if (typeof fullName !== "string") return null;
  const normalized = fullName.trim().replace(/\s+/g, " ").slice(0, 80);
  return normalized || null;
}
