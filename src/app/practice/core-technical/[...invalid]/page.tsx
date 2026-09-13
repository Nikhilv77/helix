import { redirect } from "next/navigation";

/** Unknown Core Technical child paths return to the session home. */
export default function InvalidCoreTechnicalPath() {
  redirect("/practice/core-technical");
}
