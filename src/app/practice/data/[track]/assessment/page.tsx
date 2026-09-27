import { privatePageMetadata } from "@/lib/shared/seo";
import { StoryTrackAssessmentPage } from "@/features/practice/story-tracks/ui/story-track-pages";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Data Assessment",
  "Written assessment for a finished Data practice path."
);

export default function DataAssessmentPage({
  params,
  searchParams
}: {
  params: Promise<{ track: string }>;
  searchParams: Promise<{ session?: string | string[] }>;
}) {
  return <StoryTrackAssessmentPage discipline="data" params={params} searchParams={searchParams} />;
}
