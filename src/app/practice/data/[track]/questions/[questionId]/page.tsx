import { privatePageMetadata } from "@/lib/shared/seo";
import { StoryTrackQuestionPage } from "@/features/practice/story-tracks/ui/story-track-pages";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Data Engineering Practice Question",
  "A question in your data engineering practice path."
);

export default function DataPracticeQuestionPage({
  params
}: {
  params: Promise<{ track: string; questionId: string }>;
}) {
  return <StoryTrackQuestionPage discipline="data" params={params} />;
}
