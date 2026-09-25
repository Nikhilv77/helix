import type { Prisma } from "@prisma/client";

import type { HelpHistoryParticipant } from "@/features/peer-help/contracts/help-history";

export interface HelpParticipantProfile {
  headline: string | null;
  profileImage: string | null;
  resumeAnalysis?: Prisma.JsonValue | null;
  fullName?: string | null;
}

/** Public identity used across peer-help surfaces. */
export function presentHelpParticipant(
  profile: HelpParticipantProfile | null | undefined
): HelpHistoryParticipant {
  return {
    label: normalizeName(profile?.fullName) ?? profileName(profile?.resumeAnalysis) ?? "Trailgrad candidate",
    headline: profile?.headline ?? null,
    profileImage: profile?.profileImage ?? null
  };
}

function profileName(value: Prisma.JsonValue | null | undefined): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const fullName = value.fullName;
  if (typeof fullName !== "string") return null;
  return normalizeName(fullName);
}

function normalizeName(fullName: string | null | undefined): string | null {
  if (typeof fullName !== "string") return null;
  const normalized = fullName.trim().replace(/\s+/g, " ").slice(0, 80);
  return normalized || null;
}
