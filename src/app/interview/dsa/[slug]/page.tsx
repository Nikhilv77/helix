import { redirect } from "next/navigation";
import { privatePageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  await params;
  return privatePageMetadata("DSA interview", "A DSA interview with Maya based on the questions you have solved.");
}

export default async function DsaInterviewPage({ params }: { params: Promise<{ slug: string }> }) {
  await params;
  redirect("/interview/dsa");
}
