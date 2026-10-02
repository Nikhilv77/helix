import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { requireAdmin } from "@/features/admin/server/admin-access";
import { peopleByOwnerId, searchOwnerIds } from "@/features/admin/server/admin-directory";
import { CohortGrid } from "@/features/admin/ui/admin-charts";
import {
  AdminCard,
  AdminPage,
  BarList,
  EmptyNote,
  formatDay,
  formatNumber,
  formatRelativeDay,
  PersonAvatar,
  readableLabel
} from "@/features/admin/ui/admin-ui";
import { authenticatedOwnerId, ownerIdToUserId } from "@/features/interviews/server/owner";
import { privatePageMetadata } from "@/lib/shared/seo";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata("Users · Admin", "Every Trailgrad account.");

const PAGE_SIZE = 25;

type PageProps = { searchParams: Promise<{ q?: string | string[]; page?: string | string[] }> };

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const app = await requireAdmin();
  const params = await searchParams;
  const query = first(params.q)?.trim() ?? "";
  const page = Math.max(1, Math.floor(Number(first(params.page)) || 1));
  // Names and emails live in Clerk, so a search asks Clerk first. A pasted
  // Clerk id also matches directly.
  const ownerIds = query
    ? [
        ...(await searchOwnerIds(query)),
        ...(query.startsWith("user_") ? [authenticatedOwnerId(query)] : [])
      ]
    : null;
  const users = await app.adminAnalyticsService.users({ page, pageSize: PAGE_SIZE, ownerIds });
  const people = await peopleByOwnerId(users.rows.map((row) => row.ownerId));
  const pages = Math.max(1, Math.ceil(users.total / PAGE_SIZE));
  const pageHref = (target: number) =>
    `/admin/users?${new URLSearchParams({ ...(query ? { q: query } : {}), page: String(target) })}`;

  return (
    <AdminPage
      title="Users"
      description="Every account, most recently active first. Open one to see everything they have done."
    >
      <AdminCard
        title={query ? `${formatNumber(users.total)} matching “${query}”` : `${formatNumber(users.total)} accounts`}
        aside={
          <form action="/admin/users" className="relative w-[min(20rem,70vw)]">
            <Search
              size={16}
              strokeWidth={1.5}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cream/40"
              aria-hidden="true"
            />
            <input
              name="q"
              defaultValue={query}
              placeholder="Search name, email, or id"
              aria-label="Search users"
              className="admin-field h-10 w-full rounded-xl pl-9 pr-3 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)]"
            />
          </form>
        }
      >
        {users.rows.length ? (
          <div className="thin-scroll -mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
            <table className="w-full min-w-[56rem] text-[14px]">
              <thead>
                <tr className="admin-rule text-left text-[13px] text-cream/45">
                  <th className="pb-3 pr-4 font-medium">Person</th>
                  <th className="pb-3 pr-4 font-medium">Track</th>
                  <th className="pb-3 pr-4 font-medium">Joined</th>
                  <th className="pb-3 pr-4 font-medium">Last active</th>
                  <th className="pb-3 pr-4 text-right font-medium">Attempts, 30 days</th>
                  <th className="pb-3 pr-4 text-right font-medium">Solved</th>
                  <th className="pb-3 pr-4 text-right font-medium">Interviews</th>
                  <th className="pb-3 text-right font-medium">Roasts</th>
                </tr>
              </thead>
              <tbody>
                {users.rows.map((row) => {
                  const person = people.get(row.ownerId);
                  const userId = ownerIdToUserId(row.ownerId) ?? row.ownerId;
                  return (
                    <tr key={row.ownerId} className="admin-row admin-rule">
                      <td className="py-3 pr-4">
                        <Link
                          href={`/admin/users/${encodeURIComponent(userId)}`}
                          className="group flex min-w-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)]"
                        >
                          <PersonAvatar name={person?.name ?? person?.email ?? userId} imageUrl={person?.imageUrl ?? null} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-cream group-hover:underline group-hover:underline-offset-4">
                              {person?.name ?? person?.email ?? userId}
                            </span>
                            <span className="block truncate text-[13px] text-cream/45">
                              {person?.email ?? (row.onboarded ? "No email on file" : "Not onboarded")}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-cream/72">
                        {readableLabel(row.targetRole)}
                        {row.level ? <span className="text-cream/42"> · {readableLabel(row.level)}</span> : null}
                      </td>
                      <td className="py-3 pr-4 text-cream/72">{formatDay(row.createdAt)}</td>
                      <td className="py-3 pr-4 text-cream/72">{formatRelativeDay(row.lastActive)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-cream">{formatNumber(row.attempts30)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-cream">{formatNumber(row.solvedTotal)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-cream">{formatNumber(row.interviews)}</td>
                      <td className="py-3 text-right tabular-nums text-cream">{formatNumber(row.roasts)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyNote>{query ? "Nobody matches that search." : "No accounts yet."}</EmptyNote>
        )}

        {pages > 1 ? (
          <div className="mt-5 flex items-center justify-between text-[13px] text-cream/55">
            <span className="tabular-nums">
              Page {page} of {pages}
            </span>
            <div className="flex gap-1">
              <PageLink href={page > 1 ? pageHref(page - 1) : null} label="Previous page">
                <ChevronLeft size={17} strokeWidth={1.5} aria-hidden="true" />
              </PageLink>
              <PageLink href={page < pages ? pageHref(page + 1) : null} label="Next page">
                <ChevronRight size={17} strokeWidth={1.5} aria-hidden="true" />
              </PageLink>
            </div>
          </div>
        ) : null}
      </AdminCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminCard title="Target role" description="What people are preparing for.">
          <BarList items={users.roles.map((item) => ({ ...item, label: readableLabel(item.label) }))} />
        </AdminCard>
        <AdminCard title="Experience" description="The level each person chose at onboarding.">
          <BarList items={users.levels.map((item) => ({ ...item, label: readableLabel(item.label) }))} />
        </AdminCard>
      </div>

      <AdminCard
        title="Retention by sign-up week"
        description="Share of each week's sign-ups who were active again in each week after joining. Week 0 is the week they joined."
      >
        {users.cohorts.length ? (
          <CohortGrid cohorts={users.cohorts} />
        ) : (
          <EmptyNote>No sign-ups in the last eight weeks.</EmptyNote>
        )}
      </AdminCard>
    </AdminPage>
  );
}

function PageLink({ href, label, children }: { href: string | null; label: string; children: ReactNode }) {
  const className =
    "grid h-9 w-9 place-items-center rounded-lg border border-white/[0.1] outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)]";
  if (!href) {
    return (
      <span aria-hidden="true" className={`${className} opacity-35`}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className={`${className} text-cream/72 hover:text-cream`}>
      {children}
    </Link>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

