import { MentorDirectoryView } from "@/components/workspace/mentors/mentors-view";
import { privatePageMetadata } from "@/lib/shared/seo";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Trailguide mentors",
  "Explore Trailguide mentors across software engineering, AI, data and platform careers."
);

export default async function TrailguideMentorsPage() {
  await requireOnboardedProfile();

  return <MentorDirectoryView />;
}
