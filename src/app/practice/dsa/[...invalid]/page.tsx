import { redirect } from "next/navigation";

/** Unknown DSA child paths return to the DSA session instead of rendering a 404. */
export default function InvalidDsaPracticePath() {
  redirect("/practice/dsa");
}
