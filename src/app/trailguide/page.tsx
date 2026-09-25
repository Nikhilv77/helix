import { MentorsView } from "@/features/trailguide/ui/mentors-view";
import { privatePageMetadata } from "@/lib/shared/seo";
import { requireOnboardedOwner } from "@/server/auth/onboarding-guard";

export const dynamic = "force-dynamic";
export const unstable_dynamicStaleTime = 60;
export const metadata = privatePageMetadata(
  "Trailguide",
  "A mentor-led career program designed to help ambitious engineers prepare deeply, interview confidently and position themselves for Big Tech opportunities."
);

export default async function TrailguidePage() {
  await requireOnboardedOwner();

  return <MentorsView />;
}
