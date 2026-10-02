import { ArrowLeft, CalendarDays, CircleCheck, Code2, Flame, HandHelping, Mic } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/features/admin/server/admin-access";
import { peopleByOwnerId } from "@/features/admin/server/admin-directory";
import { DailyColumns } from "@/features/admin/ui/admin-charts";
import {
  AdminCard,
  AdminPage,
  EmptyNote,
  PersonAvatar,
  StatGrid,
  StatTile,
  formatDateTime,
  formatDay,
  formatNumber,
  formatRelativeDay,
  readableLabel
} from "@/features/admin/ui/admin-ui";
import { authenticatedOwnerId } from "@/features/interviews/server/owner";
import { privatePageMetadata } from "@/lib/shared/seo";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata("User · Admin", "One Trailgrad account.");

type PageProps = { params: Promise<{ userId: string }> };

export default async function AdminUserPage({ params }: PageProps) {
  const app = await requireAdmin();
  const ownerId = authenticatedOwnerId(decodeURIComponent((await params).userId));
  const [detail, people] = await Promise.all([
    app.adminAnalyticsService.user(ownerId),
    peopleByOwnerId([ownerId])
  ]);
  if (!detail) notFound();
  const person = people.get(ownerId);
  const name = person?.name ?? person?.email ?? ownerId.replace(/^user:/, "");
  const { profile, totals } = detail;

  return (
    <AdminPage
      title={name}
      description={[person?.email, `Joined ${formatDay(profile.createdAt)}`, `last active ${formatRelativeDay(totals.lastActive).toLowerCase()}`]
        .filter(Boolean)
        .join(" · ")}
      actions={
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-2 rounded-lg px-1 text-[14px] font-medium text-cream/62 outline-none transition-colors hover:text-cream focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent-border)]"
        >
          <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />
          All users
        </Link>
      }
    >
      <AdminCard>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <PersonAvatar name={name} imageUrl={person?.imageUrl ?? null} size="h-16 w-16" />
          <dl className="grid flex-1 gap-x-8 gap-y-4 text-[14px] sm:grid-cols-3 lg:grid-cols-6">
            <Fact label="Target role" value={readableLabel(profile.targetRole)} />
            <Fact label="Experience" value={readableLabel(profile.level)} />
            <Fact label="Target company" value={profile.targetCompany ?? "Not set"} />
            <Fact label="Interview date" value={profile.targetDate ? formatDay(profile.targetDate) : "Not set"} />
            <Fact
              label="Onboarding"
              value={
                profile.preparationCompletedAt
                  ? `Done ${formatDay(profile.preparationCompletedAt)}`
                  : profile.onboardingCompletedAt
                    ? "Preparation setup left"
                    : "Not finished"
              }
            />
            <Fact
              label="Teacher and accent"
              value={`${readableLabel(profile.teacherId ?? "none")} · ${readableLabel(profile.workspaceAccent)}`}
            />
          </dl>
        </div>
      </AdminCard>

      <StatGrid columns={6}>
        <StatTile label="Active days" icon={CalendarDays} value={formatNumber(totals.activeDays)} />
        <StatTile label="Practice attempts" icon={Code2} value={formatNumber(totals.practiceAttempts)} />
        <StatTile label="Questions solved" icon={CircleCheck} value={formatNumber(totals.practiceSolved)} />
        <StatTile
          label="Interviews"
          icon={Mic}
          value={formatNumber(totals.interviewsCompleted)}
          hint={`${formatNumber(totals.interviewsStarted)} started`}
        />
        <StatTile label="Resume roasts" icon={Flame} value={formatNumber(totals.roastsCompleted)} />
        <StatTile label="Trailmate sessions" icon={HandHelping} value={formatNumber(totals.trailmateResolved)} />
      </StatGrid>

      <AdminCard title="Activity, last 60 days" description="Practice attempts, interviews, roasts, and Trailmate sessions per day.">
        <DailyColumns points={detail.dailyActivity} unit="actions" height={160} />
      </AdminCard>

      <AdminCard title="Practice tracks" description="Questions solved or learned out of those assigned so far, and checkpoint results.">
        {detail.tracks.length ? (
          <ul>
            {detail.tracks.map((track) => {
              const done = track.solved + track.learned;
              const share = track.total ? done / track.total : 0;
              return (
                <li key={track.track} className="admin-rule grid gap-x-6 gap-y-2 py-4 first:pt-0 last:border-0 last:pb-0 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_9rem_8rem] sm:items-center">
                  <span className="truncate text-[14px] font-medium text-cream">{track.track}</span>
                  <div>
                    <div className="flex justify-between text-[13px] text-cream/50">
                      <span>
                        {formatNumber(track.solved)} solved · {formatNumber(track.learned)} learned
                      </span>
                      {track.total ? <span className="tabular-nums">{done} of {track.total}</span> : null}
                    </div>
                    {track.total ? (
                      <div className="admin-bar-track mt-1.5 h-1.5 overflow-hidden rounded-full">
                        <span className="block h-full rounded-full bg-[var(--workspace-accent)]" style={{ width: `${share * 100}%` }} />
                      </div>
                    ) : null}
                  </div>
                  <span className="text-[13px] text-cream/62 sm:text-right">
                    {track.checkpoints} {track.checkpoints === 1 ? "checkpoint" : "checkpoints"}
                  </span>
                  <span className="text-[14px] tabular-nums text-cream sm:text-right">
                    {track.averageScore === null ? <span className="text-cream/42">No score</span> : `${track.averageScore} avg`}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyNote>Has not started Practice.</EmptyNote>
        )}
      </AdminCard>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <AdminCard title="Recent interviews" description="Newest first, including checkpoint rooms.">
          {detail.interviews.length ? (
            <ul>
              {detail.interviews.map((interview) => (
                <li key={interview.id} className="admin-rule flex items-center justify-between gap-4 py-3 first:pt-0 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-cream">{interview.round}</p>
                    <p className="mt-0.5 text-[13px] text-cream/45">{formatDateTime(interview.startedAt)} UTC</p>
                  </div>
                  <span className="shrink-0 text-[13px] text-cream/62">
                    {interview.completedAt ? `Finished in ${minutesBetween(interview.startedAt, interview.completedAt)} min` : interview.phase}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyNote>No interviews yet.</EmptyNote>
          )}
        </AdminCard>
        <AdminCard title="Resume roasts">
          {detail.roasts.length ? (
            <ul>
              {detail.roasts.map((roast) => (
                <li key={roast.id} className="admin-rule flex items-center justify-between gap-4 py-3 first:pt-0 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-cream">
                      {readableLabel(roast.role)} · {readableLabel(roast.level)}
                    </p>
                    <p className="mt-0.5 text-[13px] text-cream/45">{formatDay(roast.createdAt)}</p>
                  </div>
                  <span className="shrink-0 text-[13px] text-cream/62">{readableLabel(roast.status.toLowerCase())}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyNote>No roasts yet.</EmptyNote>
          )}
        </AdminCard>
      </div>
    </AdminPage>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-cream/45">{label}</dt>
      <dd className="mt-1 truncate font-medium text-cream">{value}</dd>
    </div>
  );
}

function minutesBetween(start: string, end: string): number {
  return Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 60_000));
}
