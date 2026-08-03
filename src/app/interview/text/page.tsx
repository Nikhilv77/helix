import { redirect } from "next/navigation";

export default async function LegacyTextInterviewPage({
  searchParams
}: {
  searchParams: Promise<{ session?: string | string[] }>;
}) {
  const params = await searchParams;
  const session = Array.isArray(params.session) ? params.session[0] : params.session;

  redirect(session ? `/interview/voice?session=${encodeURIComponent(session)}` : "/interview");
}
