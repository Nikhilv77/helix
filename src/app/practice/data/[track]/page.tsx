import { privatePageMetadata } from "@/lib/shared/seo";
import { StoryTrackPage } from "@/features/practice/story-tracks/ui/story-track-pages";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Data Engineering Practice",
  "Role-specific data engineering interview practice."
);

export default function DataPracticePage({
  params,
  searchParams
}: {
  params: Promise<{ track: string }>;
  searchParams: Promise<{ block?: string | string[] }>;
}) {
  return <StoryTrackPage discipline="data" params={params} searchParams={searchParams} />;
}
