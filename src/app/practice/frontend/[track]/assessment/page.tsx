import { privatePageMetadata } from "@/lib/shared/seo";
import { StoryTrackAssessmentPage } from "@/features/practice/story-tracks/ui/story-track-pages";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Frontend Assessment",
  "Written assessment for a finished Frontend practice path."
);

export default function FrontendAssessmentPage({
  params,
  searchParams
}: {
  params: Promise<{ track: string }>;
  searchParams: Promise<{ session?: string | string[] }>;
}) {
  return <StoryTrackAssessmentPage discipline="frontend" params={params} searchParams={searchParams} />;
}
