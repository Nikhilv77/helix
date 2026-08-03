import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { InterviewReport } from "@/components/workspace/interview-report";
import { getAppContainer } from "@/server/app-container";
import { AppHttpError } from "@/server/common/http-error";
import { authenticatedOwnerId } from "@/server/interview/owner";

export const dynamic = "force-dynamic";

export default async function SessionReportPage({
  params
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const { sessionId } = await params;
  try {
    const report = await getAppContainer().interviewService.report(
      authenticatedOwnerId(userId),
      sessionId
    );
    return <InterviewReport report={report} />;
  } catch (error) {
    if (error instanceof AppHttpError && error.statusCode === 404) notFound();
    throw error;
  }
}
