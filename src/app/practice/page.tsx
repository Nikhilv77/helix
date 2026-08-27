import { PracticeSessionsView } from "@/components/workspace/practice/practice-sessions-view";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";
import { Logger } from "@/server/common/logger";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Practice",
  "The DSA patterns and questions in your Trailgrad preparation path."
);
const logger = new Logger("PracticePage");

/** The six-session Practice entry point, visually paired with Interviews. */
export default async function PracticePage() {
  const { ownerId, profile } = await requireOnboardedProfile();
  const container = getAppContainer();
  let generationFailed = false;
  const practiceRoadmap = await container.practiceRoadmapService.home(ownerId).catch((error) => {
    generationFailed = true;
    logger.error({
      event: "practice.roadmap_generation_failed",
      ownerId,
      reason: error instanceof Error ? error.message : "unknown"
    });
    return null;
  });

  return (
    <PracticeSessionsView
      profile={profile}
      practiceRoadmap={practiceRoadmap}
      generationFailed={generationFailed}
    />
  );
}
