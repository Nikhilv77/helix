import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { ArchitectureDesignOverview } from "@/features/practice/architecture-design/ui/architecture-design-overview";
import { ArchitectureDesignTechnologyWelcome } from "@/features/practice/architecture-design/ui/architecture-design-technology-welcome";
import { architectureDesignHistoryNavigation } from "@/features/practice/architecture-design/domain/ui-state";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Architecture & Design Practice",
  "Role-aligned system-design practice through one coherent architecture scenario."
);

export default async function ArchitectureDesignPracticePage({
  searchParams
}: {
  searchParams: Promise<{ block?: string | string[] }>;
}) {
  const { ownerId, profile } = await requireOnboardedProfile();
  const app = getAppContainer();
  const services = app.architectureDesign;
  const allowEarlyAssessmentStart = app.config.nodeEnv === "development";
  const recovery = services.assessment.recoverCurrentInterview(ownerId).catch(() => null);
  const query = await searchParams;
  const requestedBlockId = typeof query.block === "string" ? query.block : null;
  await recovery;
  const [eligibility, currentBlock, historyList] = await Promise.all([
    services.eligibility.forProfile(profile),
    services.practice.current(ownerId),
    services.history.list(ownerId)
  ]);

  let block = currentBlock;
  if (requestedBlockId) {
    try {
      block = await services.history.read(ownerId, requestedBlockId);
    } catch (error) {
      if (
        error instanceof NotFoundErrorException &&
        error.code === "ARCHITECTURE_DESIGN_BLOCK_NOT_FOUND"
      ) {
        notFound();
      }
      throw error;
    }
  }

  const needsFirstScenario = !block && eligibility.available;
  if (needsFirstScenario) {
    return <ArchitectureDesignTechnologyWelcome />;
  }

  return (
    <main className="mx-auto w-full max-w-[86rem] px-4 pb-20 pt-7 sm:px-7 sm:pt-9 lg:px-8 lg:pt-8">
      <Link
        href="/practice"
        className="mb-5 inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-[12.5px] font-semibold text-cream/52 transition hover:bg-white/[0.055] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)]"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back to Practice
      </Link>

      {block ? (
        <ArchitectureDesignOverview
          block={block}
          history={architectureDesignHistoryNavigation(historyList, block.id)}
          scenarioLibrary={eligibility.scenarios}
          scenarioHistory={historyList}
          allowEarlyAssessmentStart={allowEarlyAssessmentStart}
        />
      ) : (
        <Unavailable message={eligibility.message} />
      )}
    </main>
  );
}

function Unavailable({ message }: { message: string }) {
  return (
    <section
      role="status"
      className="mt-10 max-w-2xl rounded-[1.4rem] border border-white/[0.085] bg-[#141619] px-5 py-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] sm:px-7"
    >
      <LockKeyhole size={20} aria-hidden="true" className="text-cream/42" />
      <h1 className="mt-5 font-display text-[1.7rem] font-semibold tracking-[-0.025em] text-cream">
        Architecture &amp; Design is not available for this path yet.
      </h1>
      <p className="mt-3 max-w-xl text-[14px] leading-6 text-cream/56">{message}</p>
      <p className="mt-3 text-[13px] leading-5 text-cream/38">
        Existing DSA, Core Technical, and Applied Engineering practice remain available.
      </p>
    </section>
  );
}
