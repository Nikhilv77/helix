import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

import { ReportQueue } from "@/components/workspace/help/report-queue";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";
import { isOperator } from "@/server/help/operator";
import { authenticatedOwnerId } from "@/server/interview/owner";

export const dynamic = "force-dynamic";

export const metadata = privatePageMetadata(
  "Trailmate Reports",
  "Reports filed on Trailmate sessions, waiting for review."
);

/**
 * The moderation queue.
 *
 * Gated server-side and again in the API behind it, so the page shell can never
 * be the only thing standing between somebody and other people's report text.
 * Both gates 404 rather than 403: a forbidden page confirms there is something
 * here to find.
 */
export default async function HelpReportsPage() {
  const { userId } = await auth();
  if (!userId) notFound();

  if (!isOperator(getAppContainer().config, authenticatedOwnerId(userId))) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <header>
        <h1 className="text-[1.9rem] font-bold leading-tight text-cream sm:text-[2.2rem]">
          Reports
        </h1>
        <p className="mt-2 max-w-xl text-[14.5px] leading-6 text-cream/60">
          Filed on Trailmate sessions, most severe first. Nothing here is actioned automatically —
          reading them is the whole job.
        </p>
      </header>

      <div className="mt-8">
        <ReportQueue />
      </div>
    </div>
  );
}
