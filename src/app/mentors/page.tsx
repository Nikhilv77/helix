import { MentorsView } from "@/components/workspace/mentors/mentors-view";
import { privatePageMetadata } from "@/lib/shared/seo";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Trailguide",
  "One-to-one sessions with senior engineers who have run the interview loop you are preparing for."
);

/** Trailguide, before it opens. Static for now — nothing to load yet. */
export default async function MentorsPage() {
  await requireOnboardedProfile();

  return <MentorsView />;
}
