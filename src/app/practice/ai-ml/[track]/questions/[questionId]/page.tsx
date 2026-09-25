import { privatePageMetadata } from "@/lib/shared/seo";
import { StoryTrackQuestionPage } from "@/features/practice/story-tracks/ui/story-track-pages";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "AI/ML Practice Question",
  "A question in your AI/ML practice path."
);

export default function AiMlPracticeQuestionPage({
  params
}: {
  params: Promise<{ track: string; questionId: string }>;
}) {
  return <StoryTrackQuestionPage discipline="ai-ml" params={params} />;
}
