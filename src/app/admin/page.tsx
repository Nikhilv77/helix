import {
  Activity,
  CalendarCheck,
  CircleCheck,
  Code2,
  Flame,
  HandHelping,
  Mic,
  Repeat2,
  UsersRound
} from "lucide-react";

import { requireAdmin } from "@/features/admin/server/admin-access";
import { DailyColumns } from "@/features/admin/ui/admin-charts";
import {
  AdminCard,
  AdminPage,
  Funnel,
  RangeTabs,
  StatGrid,
  StatTile,
  formatNumber,
  formatPercent
} from "@/features/admin/ui/admin-ui";
import { privatePageMetadata } from "@/lib/shared/seo";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata("Admin", "How Trailgrad is being used.");

const WINDOWS = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" }
] as const;

type PageProps = { searchParams: Promise<{ days?: string | string[] }> };

export default async function AdminOverviewPage({ searchParams }: PageProps) {
  const app = await requireAdmin();
  const days = windowDays((await searchParams).days);
  const overview = await app.adminAnalyticsService.overview(days);
  const { users, active, totals } = overview;
  const growth = users.newInWindow - users.newInPreviousWindow;
  const retention = overview.weekOneRetention;

  return (
    <AdminPage
      title="Overview"
      description="Who is signing up, who comes back, and what they do once they are here."
      actions={
        <RangeTabs options={WINDOWS} current={days} href={(value) => `/admin?days=${value}`} />
      }
    >
      <StatGrid>
        <StatTile
          label="Users"
          icon={UsersRound}
          value={formatNumber(users.total)}
          hint={
            <>
              {formatNumber(users.newInWindow)} new in {days} days
              {users.newInPreviousWindow || users.newInWindow
                ? `, ${growth >= 0 ? "+" : ""}${formatNumber(growth)} on the window before`
                : ""}
            </>
          }
        />
        <StatTile
          label="Active in the last 7 days"
          icon={Activity}
          value={formatNumber(active.week)}
          hint={`${formatNumber(active.today)} today, ${formatNumber(active.month)} in 30 days`}
        />
        <StatTile
          label="Week-one return rate"
          icon={Repeat2}
          value={retention.eligible ? formatPercent(retention.retained / retention.eligible) : "—"}
          hint={
            retention.eligible
              ? `${retention.retained} of ${retention.eligible} came back within a week of signing up`
              : "Needs sign-ups older than a week"
          }
        />
        <StatTile
          label="Onboarded"
          icon={CalendarCheck}
          value={users.total ? formatPercent(users.onboarded / users.total) : "—"}
          hint={`${formatNumber(users.onboarded)} of ${formatNumber(users.total)} finished onboarding`}
        />
      </StatGrid>

      <div className="grid gap-6 xl:grid-cols-2">
        <AdminCard title="Daily active learners" description="People who practised, interviewed, roasted, or helped that day.">
          <DailyColumns points={overview.dailyActive} unit="active" />
        </AdminCard>
        <AdminCard title="Sign-ups" description="New accounts per day.">
          <DailyColumns points={overview.dailySignups} unit="sign-ups" />
        </AdminCard>
      </div>

      <StatGrid columns={6}>
        <StatTile label="Practice attempts" icon={Code2} value={formatNumber(totals.practiceAttempts)} />
        <StatTile
          label="Questions solved"
          icon={CircleCheck}
          value={formatNumber(totals.practiceSolved)}
          hint={
            totals.practiceAttempts
              ? `${formatPercent(totals.practiceSolved / totals.practiceAttempts)} of attempts`
              : undefined
          }
        />
        <StatTile label="Interviews started" icon={Mic} value={formatNumber(totals.interviewsStarted)} />
        <StatTile
          label="Interviews completed"
          icon={Mic}
          value={formatNumber(totals.interviewsCompleted)}
          hint={
            totals.interviewsStarted
              ? `${formatPercent(totals.interviewsCompleted / totals.interviewsStarted)} finish rate`
              : undefined
          }
        />
        <StatTile label="Resume roasts" icon={Flame} value={formatNumber(totals.roastsCompleted)} />
        <StatTile label="Trailmate sessions" icon={HandHelping} value={formatNumber(totals.trailmateResolved)} />
      </StatGrid>

      <AdminCard
        title="Activation"
        description="Every account ever, and how far each got. The figure beside each step is the share of the step before it."
      >
        <Funnel steps={overview.funnel} />
      </AdminCard>
    </AdminPage>
  );
}

function windowDays(value: string | string[] | undefined): number {
  const days = Number(Array.isArray(value) ? value[0] : value);
  return WINDOWS.some((window) => window.value === days) ? days : 30;
}
