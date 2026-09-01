import { redirect } from "next/navigation";

/** Preserve the original Trailguide URL for saved links and older clients. */
export default function LegacyMentorsPage() {
  redirect("/trailguide");
}
