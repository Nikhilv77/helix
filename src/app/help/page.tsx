import { redirect } from "next/navigation";

/** Keep old notifications and bookmarks working without maintaining a page. */
export default async function LegacyHelpPage({
  searchParams
}: {
  searchParams: Promise<{ request?: string | string[] }>;
}) {
  const query = await searchParams;
  const request = Array.isArray(query.request) ? query.request[0] : query.request;

  redirect(request ? `/profile?help=1&request=${encodeURIComponent(request)}` : "/profile?help=1");
}
