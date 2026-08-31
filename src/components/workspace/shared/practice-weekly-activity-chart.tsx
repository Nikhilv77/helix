const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en", {
  weekday: "short",
  timeZone: "UTC"
});

const FULL_DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  weekday: "long",
  month: "short",
  day: "numeric",
  timeZone: "UTC"
});

export interface PracticeActivityDay {
  date: string;
  solved: number;
}

export function PracticeWeeklyActivityChart({
  activity,
  ariaLabel
}: {
  activity: PracticeActivityDay[];
  ariaLabel?: string;
}) {
  const dailyTarget = Math.max(3, ...activity.map((day) => day.solved));
  const totalSolved = activity.reduce((total, day) => total + day.solved, 0);

  return (
    <div
      className="w-full"
      role="img"
      aria-label={
        ariaLabel ??
        `${totalSolved} question${totalSolved === 1 ? "" : "s"} solved in the last ${activity.length || 7} days`
      }
    >
      <div className="grid grid-cols-7 gap-3 sm:gap-4">
        {activity.map((day, index) => {
          const date = new Date(`${day.date}T00:00:00.000Z`);
          const tooltipId = `practice-activity-${day.date}`;
          return (
            <div
              key={day.date}
              className="group relative min-w-0"
              style={{ gridColumnStart: 8 - activity.length + index }}
              tabIndex={0}
              aria-describedby={tooltipId}
            >
              <div className="flex h-32 items-end overflow-hidden rounded-[1.45rem] bg-white/[0.07]">
                <span
                  className="w-full rounded-b-[1.45rem] rounded-t-[0.7rem] bg-[var(--workspace-accent)] transition-[height] duration-500 ease-out"
                  style={{ height: `${Math.min(100, (day.solved / dailyTarget) * 100)}%` }}
                />
              </div>
              <span className="mt-2 block text-center text-[10px] font-medium text-cream/42">
                {WEEKDAY_FORMATTER.format(date)}
              </span>
              <span
                id={tooltipId}
                role="tooltip"
                className="pointer-events-none absolute bottom-[calc(100%+0.65rem)] left-1/2 z-10 w-max max-w-40 -translate-x-1/2 rounded-md bg-[#0e0f11] px-2.5 py-2 text-center text-[11px] leading-4 text-cream opacity-0 shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100"
              >
                <span className="block text-cream/58">{FULL_DATE_FORMATTER.format(date)}</span>
                <span className="block font-medium">
                  {day.solved} question{day.solved === 1 ? "" : "s"} solved
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
