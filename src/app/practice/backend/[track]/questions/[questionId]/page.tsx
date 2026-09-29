import { privatePageMetadata } from "@/lib/shared/seo";
import { StoryTrackQuestionPage } from "@/features/practice/story-tracks/ui/story-track-pages";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Backend Fundamentals Question",
  "A question in your backend fundamentals practice path."
);

export default function BackendPracticeQuestionPage({
  params
}: {
  params: Promise<{ track: string; questionId: string }>;
}) {
  return <StoryTrackQuestionPage discipline="backend" params={params} />;
}
