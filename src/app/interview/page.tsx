import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function InterviewSetupPage() {
  await requireOnboardedProfile();
  redirect("/interviews");
}
