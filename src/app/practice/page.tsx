import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DsaTopics } from "@/components/workspace/dsa-topics";
import { privatePageMetadata } from "@/lib/seo";
import { getAppContainer } from "@/server/app-container";
import { authenticatedOwnerId } from "@/server/interview/owner";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Practice",
  "The DSA patterns and questions in your Trailgrad preparation path."
);

/** Session one's content: the DSA pattern chapters, opened from Home. */
export default async function PracticePage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const ownerId = authenticatedOwnerId(userId);
  const container = getAppContainer();
  const [profile, plan, roadmap, questionStatuses] = await Promise.all([
    container.profileService.get(ownerId),
    container.dsaService.frontendPlan().catch(() => null),
    // Practice shows this user's own position in the session, so it reads the
    // persisted roadmap rather than the shared curation alone.
    container.frontendRoadmapService.home(ownerId).catch(() => null),
    container.frontendRoadmapService.questionStatuses(ownerId).catch(() => ({}))
  ]);

  return (
    <div className="pb-10">
      <div className="mx-auto w-full max-w-[95rem] px-5 sm:px-8 lg:px-10">
        {plan ? (
          <DsaTopics
            plan={plan}
            roadmap={roadmap}
            questionStatuses={questionStatuses}
            targetRole={profile.targetRole}
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
