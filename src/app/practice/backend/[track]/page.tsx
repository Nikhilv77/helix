import { privatePageMetadata } from "@/lib/shared/seo";
import { StoryTrackPage } from "@/features/practice/story-tracks/ui/story-track-pages";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Backend Fundamentals Practice",
  "Language-independent backend interview practice."
);

export default function BackendPracticePage({
  params,
  searchParams
}: {
  params: Promise<{ track: string }>;
  searchParams: Promise<{ block?: string | string[] }>;
}) {
  return <StoryTrackPage discipline="backend" params={params} searchParams={searchParams} />;
}
