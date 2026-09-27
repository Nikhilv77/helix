import { privatePageMetadata } from "@/lib/shared/seo";
import { StoryTrackAssessmentPage } from "@/features/practice/story-tracks/ui/story-track-pages";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "AI/ML Assessment",
  "Written assessment for a finished AI/ML practice path."
);

export default function AIMLAssessmentPage({
  params,
  searchParams
}: {
  params: Promise<{ track: string }>;
  searchParams: Promise<{ session?: string | string[] }>;
}) {
  return <StoryTrackAssessmentPage discipline="ai-ml" params={params} searchParams={searchParams} />;
}
