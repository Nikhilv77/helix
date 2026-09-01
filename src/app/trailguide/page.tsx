import { MentorsView } from "@/components/workspace/mentors/mentors-view";
import { privatePageMetadata } from "@/lib/shared/seo";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Trailguide",
  "A mentor-led career program designed to help ambitious engineers prepare deeply, interview confidently and position themselves for Big Tech opportunities."
);

export default async function TrailguidePage() {
  await requireOnboardedProfile();

  return <MentorsView />;
}
