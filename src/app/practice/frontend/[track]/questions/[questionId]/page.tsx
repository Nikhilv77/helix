import { privatePageMetadata } from "@/lib/shared/seo";
import { StoryTrackQuestionPage } from "@/features/practice/story-tracks/ui/story-track-pages";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Frontend Practice Question",
  "A question in your frontend practice path."
);

export default function FrontendPracticeQuestionPage({
  params
}: {
  params: Promise<{ track: string; questionId: string }>;
}) {
  return <StoryTrackQuestionPage discipline="frontend" params={params} />;
}
