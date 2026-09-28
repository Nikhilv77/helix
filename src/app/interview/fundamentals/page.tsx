import { redirect } from "next/navigation";

/** The standalone fundamentals round was retired; its questions live in the Technical round. */
export default function RetiredFundamentalsInterviewPage() {
  redirect("/interviews");
}
