import { privatePageMetadata } from "@/lib/shared/seo";
import { StoryTrackPage } from "@/features/practice/story-tracks/ui/story-track-pages";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Frontend Practice",
  "Role-specific frontend engineering interview practice."
);

export default function FrontendPracticePage({
  params,
  searchParams
}: {
  params: Promise<{ track: string }>;
  searchParams: Promise<{ block?: string | string[] }>;
}) {
  return <StoryTrackPage discipline="frontend" params={params} searchParams={searchParams} />;
}
