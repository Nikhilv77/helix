import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
    <div className="mx-auto w-full max-w-[86rem] px-4 pb-20 pt-7 sm:px-7 sm:pt-9 lg:px-8 lg:pt-8">
      <Link
        href="/practice"
        className="mb-5 inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-[12.5px] font-semibold text-cream/52 transition hover:bg-white/[0.055] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)]"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back to Practice
      </Link>
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
