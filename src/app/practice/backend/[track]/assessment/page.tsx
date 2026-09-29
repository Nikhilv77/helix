import { privatePageMetadata } from "@/lib/shared/seo";
import { StoryTrackAssessmentPage } from "@/features/practice/story-tracks/ui/story-track-pages";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Backend Assessment",
  "Written assessment for a finished backend fundamentals path."
);

export default function BackendAssessmentPage({
  params,
  searchParams
}: {
  params: Promise<{ track: string }>;
  searchParams: Promise<{ session?: string | string[] }>;
}) {
  return (
    <StoryTrackAssessmentPage discipline="backend" params={params} searchParams={searchParams} />
  );
}
