import { redirect } from "next/navigation";

/** Invalid nested chapter URLs return to the Practice library. */
export default function InvalidPracticeChapterPath() {
  redirect("/practice");
}
