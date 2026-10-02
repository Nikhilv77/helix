import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<{ hours?: string | string[] }>;
};

/** The old operations console now lives in the admin dashboard. */
export default async function InterviewOperationsPage({ searchParams }: PageProps) {
  const hours = (await searchParams).hours;
  const value = Array.isArray(hours) ? hours[0] : hours;
  redirect(value ? `/admin/interviews?hours=${encodeURIComponent(value)}` : "/admin/interviews");
}
