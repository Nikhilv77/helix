import { notFound } from "next/navigation";
import { InterviewReport } from "@/components/workspace/sessions/interview-report";
import { privatePageMetadata } from "@/lib/shared/seo";
import { getAppContainer } from "@/server/app-container";
import { AppHttpError } from "@/server/common/http-error";
import { requireOnboardedProfile } from "@/server/auth/onboarding-guard";
import { MAYA, personaById } from "@/lib/avatars/personas";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata(
  "Interview Report",
  "Review your Trailgrad interview transcript, scoring, and improvement notes."
);

export default async function SessionReportPage({
  params
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { ownerId, profile } = await requireOnboardedProfile();
  const teacherName = (personaById(profile.teacherId) ?? MAYA).name;
  const { sessionId } = await params;
  try {
    const report = await getAppContainer().interviewService.report(ownerId, sessionId);
    return <InterviewReport report={report} teacherName={teacherName} />;
  } catch (error) {
    if (error instanceof AppHttpError && error.statusCode === 404) notFound();
    throw error;
  }
}
