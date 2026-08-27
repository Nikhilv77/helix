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
    <div className="mx-auto w-full max-w-[94rem] px-4 pb-20 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pt-10">
      {plan ? (
        <DsaTopics plan={plan} roadmap={roadmap} questionStatuses={questionStatuses} />
      ) : (
        <div
          role="alert"
          className="workspace-accent-card-glow mt-10 rounded-2xl border border-[color-mix(in_srgb,var(--workspace-accent)_24%,transparent)] px-5 py-6 text-sm text-cream/62"
        >
          The question bank is unavailable right now. Refresh in a moment.
        </div>
      )}
    </div>
  );
}
