import { BookOpen, CircleCheck, Flag, UsersRound } from "lucide-react";

import { requireAdmin } from "@/features/admin/server/admin-access";
import { DailyColumns } from "@/features/admin/ui/admin-charts";
import {
  AdminCard,
  AdminPage,
  EmptyNote,
  RangeTabs,
  StatGrid,
  StatTile,
  formatNumber
} from "@/features/admin/ui/admin-ui";
import { privatePageMetadata } from "@/lib/shared/seo";

export const dynamic = "force-dynamic";
export const metadata = privatePageMetadata("Practice · Admin", "How Practice is being used.");

const WINDOWS = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" }
] as const;

type PageProps = { searchParams: Promise<{ days?: string | string[] }> };

export default async function AdminPracticePage({ searchParams }: PageProps) {
  const app = await requireAdmin();
  const raw = (await searchParams).days;
  const requested = Number(Array.isArray(raw) ? raw[0] : raw);
  const days = WINDOWS.some((window) => window.value === requested) ? requested : 30;
  const practice = await app.adminAnalyticsService.practice(days);
  const sum = (key: "solved" | "learned" | "checkpointsCompleted" | "checkpointsInProgress") =>
    practice.tracks.reduce((total, track) => total + track[key], 0);
  const learned = sum("learned");
  const solved = sum("solved");

  return (
    <AdminPage
      title="Practice"
      description="Which tracks people use, how often they solve rather than reveal, and how checkpoints go."
      actions={
        <RangeTabs options={WINDOWS} current={days} href={(value) => `/admin/practice?days=${value}`} />
      }
    >
      <StatGrid>
        <StatTile
          label="Questions solved"
          icon={CircleCheck}
          value={formatNumber(solved)}
          hint={`Across every track in the last ${days} days`}
        />
        <StatTile
          label="Marked learned"
          icon={BookOpen}
          value={formatNumber(learned)}
          hint={
            solved + learned
              ? `${Math.round((learned / (solved + learned)) * 100)}% of finished questions were revealed, not solved`
              : undefined
          }
        />
        <StatTile
          label="Checkpoints completed"
          icon={Flag}
          value={formatNumber(sum("checkpointsCompleted"))}
          hint={`${formatNumber(sum("checkpointsInProgress"))} in progress now`}
        />
        <StatTile
          label="People practising"
          icon={UsersRound}
          value={formatNumber(practice.learners)}
          hint={`Submitted at least one answer in the last ${days} days`}
        />
      </StatGrid>

      <AdminCard title="Practice attempts" description="Every submitted answer, per day.">
        <DailyColumns points={practice.dailyAttempts} unit="attempts" />
      </AdminCard>

      <AdminCard
        title="Tracks"
        description="Learners, solved, and learned count the window. Ready and in progress are right now."
      >
        <div className="thin-scroll -mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
          <table className="w-full min-w-[52rem] text-[14px]">
            <thead>
              <tr className="admin-rule text-left text-[13px] text-cream/45">
                <th className="pb-3 pr-4 font-medium">Track</th>
                <th className="pb-3 pr-4 text-right font-medium">Learners</th>
                <th className="pb-3 pr-4 font-medium">Solved vs learned</th>
                <th className="pb-3 pr-4 text-right font-medium">Ready</th>
                <th className="pb-3 pr-4 text-right font-medium">In progress</th>
                <th className="pb-3 pr-4 text-right font-medium">Completed</th>
                <th className="pb-3 text-right font-medium">Average score</th>
              </tr>
            </thead>
            <tbody>
              {practice.tracks.map((track) => {
                const finished = track.solved + track.learned;
                return (
                  <tr key={track.track} className="admin-row admin-rule">
                    <td className="py-3.5 pr-4 font-medium text-cream">{track.track}</td>
                    <td className="py-3.5 pr-4 text-right tabular-nums text-cream">{formatNumber(track.learners)}</td>
                    <td className="w-[16rem] py-3.5 pr-4">
                      <div className="flex justify-between text-[13px] text-cream/55">
                        <span className="tabular-nums">{formatNumber(track.solved)} solved</span>
                        <span className="tabular-nums">{formatNumber(track.learned)} learned</span>
                      </div>
                      <div className="admin-bar-track mt-1.5 h-1.5 overflow-hidden rounded-full">
                        <span
                          className="block h-full rounded-full bg-[var(--workspace-accent)]"
                          style={{ width: `${finished ? (track.solved / finished) * 100 : 0}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3.5 pr-4 text-right tabular-nums text-cream/72">{formatNumber(track.checkpointsReady)}</td>
                    <td className="py-3.5 pr-4 text-right tabular-nums text-cream/72">{formatNumber(track.checkpointsInProgress)}</td>
                    <td className="py-3.5 pr-4 text-right tabular-nums text-cream">{formatNumber(track.checkpointsCompleted)}</td>
                    <td className="py-3.5 text-right tabular-nums text-cream">
                      {track.averageScore === null ? <span className="text-cream/42">—</span> : track.averageScore}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </AdminCard>

      <AdminCard
        title="Most often revealed"
        description="Story-track questions people marked learned instead of answering. A question high on this list may be too hard or unclear."
      >
        {practice.mostLearned.length ? (
          <ul>
            {practice.mostLearned.map((question) => (
              <li
                key={`${question.track}:${question.title}`}
                className="admin-rule flex items-center justify-between gap-4 py-3 first:pt-0 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-cream">{question.title}</p>
                  <p className="mt-0.5 text-[13px] text-cream/45">{question.track}</p>
                </div>
                <span className="shrink-0 text-[13px] tabular-nums text-cream/62">
                  {question.learned} learned · {question.solved} solved
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyNote>No question has been revealed yet.</EmptyNote>
        )}
      </AdminCard>
    </AdminPage>
  );
}
