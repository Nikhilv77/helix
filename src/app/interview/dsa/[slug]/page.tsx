import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * The per-problem DSA workspace was folded into the live interview room, which
 * shows the selected problems in the order the plan asks about them. This stub
 * keeps older links working by sending them to the round's entry screen.
 */
export default async function DsaInterviewPage({ params }: { params: Promise<{ slug: string }> }) {
  await params;
  redirect("/interview/dsa");
}
