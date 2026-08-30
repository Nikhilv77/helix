import { DsaTopics } from "@/components/workspace/dsa/dsa-topics";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "DSA Practice",
  "The DSA patterns and questions in your Trailgrad preparation path."
);

/** The existing, fully implemented first Practice session. */
export default async function DsaPracticePage() {
  const { ownerId } = await requireOnboardedProfile();
  const container = getAppContainer();
  const [plan, roadmap, questionStatuses] = await Promise.all([
    container.dsaService.frontendPlan().catch(() => null),
    container.frontendRoadmapService.home(ownerId).catch(() => null),
    container.frontendRoadmapService.questionStatuses(ownerId).catch(() => ({}))
  ]);

  return (
    <div className="mx-auto w-full max-w-[92rem] px-4 pb-20 pt-10 sm:px-8 sm:pt-14 lg:px-10 lg:pt-16">
      {plan ? (
        <DsaTopics plan={plan} roadmap={roadmap} questionStatuses={questionStatuses} />
      ) : (
        <div
          role="alert"
          className="mt-10 rounded-2xl border border-white/[0.1] bg-black px-5 py-6 text-sm text-cream/62"
        >
          The question bank is unavailable right now. Refresh in a moment.
        </div>
      )}
    </div>
  );
}
