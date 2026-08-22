import { DsaTopics } from "@/components/workspace/dsa/dsa-topics";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Practice",
  "The DSA patterns and questions in your Trailgrad preparation path."
);

/** Session one's content: the DSA pattern chapters, opened from Home. */
export default async function PracticePage() {
  const { ownerId } = await requireOnboardedProfile();
  const container = getAppContainer();
  const [plan, roadmap, questionStatuses] = await Promise.all([
    container.dsaService.frontendPlan().catch(() => null),
    // Practice shows this user's own position in the session, so it reads the
    // persisted roadmap rather than the shared curation alone.
    container.frontendRoadmapService.home(ownerId).catch(() => null),
    container.frontendRoadmapService.questionStatuses(ownerId).catch(() => ({}))
  ]);

  return (
    <div>
      <div className="mx-auto w-full max-w-[84rem] px-4 pb-20 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pt-10">
        {plan ? (
          <DsaTopics
            plan={plan}
            roadmap={roadmap}
            questionStatuses={questionStatuses}
          />
        ) : (
          <p className="mt-10 text-sm text-cream/45">
            The question bank is unavailable right now. Refresh in a moment.
          </p>
        )}
      </div>
    </div>
  );
}
