import { privatePageMetadata } from "@/lib/shared/seo";
import { StoryTrackPage } from "@/features/practice/story-tracks/ui/story-track-pages";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "AI/ML Practice",
  "Role-specific AI and machine-learning interview practice."
);

export default function AiMlPracticePage({
  params,
  searchParams
}: {
  params: Promise<{ track: string }>;
  searchParams: Promise<{ block?: string | string[] }>;
}) {
  return <StoryTrackPage discipline="ai-ml" params={params} searchParams={searchParams} />;
}
