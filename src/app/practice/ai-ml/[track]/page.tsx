import { notFound, redirect } from "next/navigation";
import { isAiMlPracticeTrack } from "@/features/practice/ai-ml/domain/ai-ml-practice";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AiMlStoryOverview } from "@/features/practice/ai-ml/ui/ai-ml-story-overview";
import { privatePageMetadata } from "@/lib/shared/seo";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";
import { getAppContainer } from "@/server/app-container";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "AI/ML Practice",
  "Role-specific AI and machine-learning interview practice."
);

export default async function AiMlPracticePage({
  params,
  searchParams
}: {
  params: Promise<{ track: string }>;
  searchParams: Promise<{ block?: string | string[] }>;
}) {
  const { ownerId, profile } = await requireOnboardedProfile();
  if (profile.targetRole !== "ai-ml") redirect("/practice");
  const { track } = await params;
  if (!isAiMlPracticeTrack(track)) notFound();
  if (track === "architecture-design") redirect("/practice/architecture-design");
  const session = await getAppContainer().aiMlStoryPracticeService.session(ownerId, track, profile);
  const query = await searchParams;
  const selected =
    session.blocks.find((block) => block.id === query.block) ??
    session.blocks.find((block) => block.isCurrent) ??
    session.blocks[0];
  if (!selected) notFound();
  return (
    <main className="practice-page mx-auto w-full max-w-[86rem] px-4 pb-20 pt-7 sm:px-7 sm:pt-9 lg:px-8 lg:pt-8">
      <Link
        href="/practice"
        className="mb-5 inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-[12.5px] font-semibold text-cream/52 transition hover:bg-white/[0.055] hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)]"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back to Practice
      </Link>
      <AiMlStoryOverview session={session} selected={selected} />
    </main>
  );
}
