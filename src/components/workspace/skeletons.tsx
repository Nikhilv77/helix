/**
 * Route skeletons. Each mirrors the real page's structure — same containers,
 * same card rhythm — so the layout does not jump when the data lands.
 */

function Line({ className = "" }: { className?: string }) {
  return <div className={`skeleton h-3 ${className}`} />;
}

/**
 * The waveform loader, shared with the root fallback.
 *
 * Heights are computed at module scope from the same curve the marketing hero
 * uses, and the motion is the `wave-bar` CSS animation — so this stays a
 * server component with nothing to hydrate.
 */
const waveHeights = Array.from(
  { length: 14 },
  (_, index) =>
    34 + Math.abs(Math.sin(index * 0.62 + 0.8)) * 44 + Math.abs(Math.cos(index * 0.29)) * 20
);

export function Waveform({ className }: { className?: string }) {
  return (
    <div
      className={["flex h-9 items-center justify-center gap-1", className ?? ""].join(" ").trim()}
      aria-hidden="true"
    >
      {waveHeights.map((height, index) => (
        <span
          key={index}
          className="wave-bar w-0.5 rounded-full bg-cream/55"
          style={{ height: `${height}%`, animationDelay: `${index * 62}ms` }}
        />
      ))}
    </div>
  );
}

/**
 * Content-area loader for workspace routes. The shell around it is already
 * painted and stays put, so this only fills the panel to the right of the
 * sidebar — no page-level background of its own.
 */
export function WorkspaceLoading() {
  return <DashboardSkeleton />;
}

/** A hairline bar across the top of the page while a route resolves. */
export function RouteProgress() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden"
    >
      <div className="route-progress h-full w-full bg-gradient-to-r from-transparent via-cream to-transparent" />
    </div>
  );
}

export function MayaWelcomeLoading() {
  return (
    <div
      className="onboarding-theme relative grid min-h-[100svh] place-items-center overflow-hidden"
      aria-busy="true"
      aria-label="Loading Maya introduction"
    >
      <div className="blueprint-glow" />
      <RouteProgress />
      <Waveform className="relative z-10" />
    </div>
  );
}

export function MayaWelcomeSkeleton() {
  return (
    <div
      className="grid min-h-[100svh] w-full place-items-center p-3 sm:p-6"
      aria-busy="true"
      aria-label="Loading Maya introduction"
    >
      <RouteProgress />

      <section className="route-enter relative grid h-[min(46rem,calc(100svh-1.5rem))] w-full max-w-6xl grid-rows-[minmax(12rem,30svh)_minmax(0,1fr)] overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#18191c] sm:grid-rows-[minmax(16rem,34svh)_minmax(0,1fr)] md:h-[min(43rem,calc(100svh-2rem))] md:grid-cols-[minmax(17rem,0.72fr)_minmax(0,1.28fr)] md:grid-rows-1">
        <div className="relative min-h-0 overflow-hidden bg-[#202126]">
          <div className="absolute left-[8%] top-[8%] h-2 w-2 rounded-full bg-[#9be8c1]/80" />
          <div className="absolute left-[14%] top-[16%] h-14 w-36 rounded-xl border border-cream/[0.1]" />
          <div className="absolute right-[10%] top-[18%] h-14 w-36 rounded-xl border border-cream/[0.1]" />
          <div className="absolute left-[16%] top-[48%] h-16 w-48 rounded-xl border border-cream/[0.1]" />
          <div className="absolute right-[8%] top-[58%] h-16 w-48 rounded-xl border border-cream/[0.1]" />
          <div className="absolute inset-x-[12%] top-[42%] flex h-20 items-center justify-center gap-2 opacity-35">
            {Array.from({ length: 21 }, (_, index) => (
              <span
                key={index}
                className="w-px rounded-full bg-cream"
                style={{ height: `${18 + Math.abs(Math.sin(index * 0.7)) * 46}px` }}
              />
            ))}
          </div>
          <div className="absolute inset-x-[16%] bottom-0 h-[78%] rounded-t-full bg-[#2a4aa0]/35" />
          <div className="absolute bottom-0 left-1/2 h-[68%] w-[48%] -translate-x-1/2 rounded-t-full bg-cream/[0.08]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#202126] to-transparent" />
        </div>

        <div className="relative flex min-h-0 flex-col overflow-hidden bg-[#18191c] px-5 pb-5 pt-5 sm:px-10 sm:pb-8 sm:pt-8 lg:px-14 lg:pb-9 lg:pt-10">
          <div className="flex shrink-0 items-center gap-2.5 pr-12">
            <div className="skeleton h-1.5 w-12 !rounded-full" />
            <div className="skeleton h-1.5 w-6 !rounded-full" />
            <div className="skeleton h-1.5 w-6 !rounded-full" />
          </div>

          <div className="flex min-h-0 flex-1 flex-col justify-center py-4 sm:py-8 lg:py-12">
            <div className="skeleton h-12 w-12 !rounded-lg sm:h-14 sm:w-14" />
            <div className="skeleton mt-6 h-4 w-32 !rounded-md" />
            <div className="skeleton mt-4 h-10 w-full max-w-xl sm:h-12" />
            <div className="skeleton mt-3 h-10 w-3/4 max-w-lg sm:h-12" />
            <div className="mt-6 space-y-3">
              <Line className="w-full max-w-2xl" />
              <Line className="w-5/6 max-w-xl" />
              <Line className="w-2/3 max-w-lg" />
            </div>
          </div>

          <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-cream/[0.1] pt-4 sm:flex-row sm:items-center sm:justify-between sm:pt-5">
            <div className="skeleton h-11 w-32 !rounded-xl" />
            <div className="skeleton h-12 w-36 !rounded-xl" />
          </div>
        </div>
      </section>
    </div>
  );
}

function CardSkeleton({ className = "", lines = 3 }: { className?: string; lines?: number }) {
  return (
    <section className={`surface p-6 sm:p-7 ${className}`}>
      <div className="flex items-center gap-3.5">
        <div className="skeleton h-10 w-10 !rounded-xl" />
        <Line className="w-36" />
      </div>
      <div className="mt-6 space-y-3">
        {Array.from({ length: lines }, (_, index) => (
          <Line key={index} className={index === lines - 1 ? "w-2/3" : "w-full"} />
        ))}
      </div>
    </section>
  );
}

export function DashboardSkeleton() {
  return (
    <div
      className="w-full min-w-0 max-w-[calc(100vw-1rem)] overflow-x-clip px-2 pb-6 pt-2 sm:max-w-full sm:px-3 lg:px-3"
      aria-busy="true"
      aria-label="Loading workspace"
    >
      <RouteProgress />

      {/* Hero: three equal-height cards. */}
      <section className="max-w-full">
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,0.78fr)_minmax(17rem,0.92fr)_minmax(0,1.1fr)] lg:items-stretch lg:gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(19rem,0.9fr)_minmax(0,1.15fr)] xl:gap-6">
          {/* Maya */}
          <div className="min-h-[17rem] rounded-2xl bg-[#2a4aa0] sm:min-h-[20rem] lg:min-h-[23rem]" />

          {/* Pattern carousel */}
          <div className="flex min-h-[17rem] flex-col rounded-2xl bg-[#2a4aa0] p-5">
            <div className="flex items-center justify-between">
              <Line className="w-24" />
              <div className="flex gap-1.5">
                <div className="skeleton h-8 w-8 !rounded-lg" />
                <div className="skeleton h-8 w-8 !rounded-lg" />
                <div className="skeleton h-8 w-8 !rounded-lg" />
              </div>
            </div>
            <div className="skeleton mt-4 h-6 w-2/3" />
            <Line className="mt-3 w-full" />
            <Line className="mt-2 w-5/6" />
            <div className="mt-4 flex gap-3">
              <Line className="w-24" />
              <Line className="w-12" />
            </div>
            <div className="skeleton mt-3 h-2 w-full !rounded-full" />
            <div className="mt-auto flex items-center justify-between pt-4">
              <div className="flex gap-1.5">
                {Array.from({ length: 6 }, (_, index) => (
                  <div key={index} className="skeleton h-1.5 w-1.5 !rounded-full" />
                ))}
              </div>
              <Line className="w-12" />
            </div>
          </div>

          {/* Roadmap copy */}
          <div className="flex min-h-[17rem] flex-col justify-center rounded-2xl bg-[#2a4aa0] p-5">
            <div className="skeleton h-8 w-44 !rounded-full" />
            <div className="skeleton mt-4 h-9 w-full max-w-sm" />
            <div className="skeleton mt-2 h-9 w-2/3 max-w-xs" />
            <Line className="mt-4 w-4/5" />
            <div className="mt-5 flex items-center gap-3">
              <Line className="w-28" />
              <Line className="w-20" />
            </div>
            <div className="skeleton mt-3 h-2 w-full !rounded-full" />
            <div className="mt-4 flex flex-wrap gap-4">
              <Line className="w-20" />
              <Line className="w-24" />
              <Line className="w-20" />
            </div>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <div className="skeleton h-11 w-40 !rounded-xl" />
              <div className="skeleton h-11 w-32 !rounded-xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Session cards beside Maya's insights. */}
      <section className="mt-4">
        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(17rem,25rem)]">
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="min-h-[8.75rem] rounded-2xl border border-cream/[0.075] bg-cream/[0.055] p-3.5 sm:min-h-[9.25rem] sm:p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="skeleton h-10 w-10 !rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="skeleton h-4 w-28" />
                      <div className="skeleton h-5 w-10 !rounded-full" />
                    </div>
                    <Line className="mt-2 w-full" />
                    <Line className="mt-1.5 w-2/3" />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <div className="skeleton h-6 w-20 !rounded-md" />
                  <div className="skeleton h-6 w-24 !rounded-md" />
                </div>
                <div className="skeleton mt-2 h-8 w-full !rounded-lg" />
              </div>
            ))}
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#fff8e8] to-[#e5dcc3] p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="skeleton h-8 w-8 !rounded-full" />
              <div className="min-w-0 flex-1">
                <Line className="w-28" />
                <Line className="mt-2 w-40" />
              </div>
              <div className="skeleton h-6 w-14 !rounded-full" />
            </div>
            <div className="grid min-w-0 gap-3">
              {Array.from({ length: 4 }, (_, index) => (
                <div
                  key={index}
                  className="min-h-[6.75rem] rounded-[1rem] border border-[#171a16]/[0.07] bg-[#dcefd7]/72 p-3.5"
                >
                  <div className="flex items-start gap-3">
                    <div className="skeleton h-6 w-6 !rounded-full" />
                    <div className="min-w-0 flex-1">
                      <Line className="w-20" />
                      <div className="skeleton mt-2 h-4 w-full" />
                      <div className="skeleton mt-1.5 h-4 w-3/5" />
                      <div className="mt-4 flex flex-wrap gap-2">
                        <div className="skeleton h-5 w-24 !rounded-md" />
                        <div className="skeleton h-5 w-20 !rounded-md" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export function ManageSkeleton() {
  return (
    <div
      className="relative mx-auto flex min-h-screen w-full max-w-[92rem] flex-col overflow-hidden px-5 py-8 text-cream sm:px-8 lg:px-10"
      aria-busy="true"
      aria-label="Loading manage account"
    >
      <RouteProgress />

      <div className="relative z-10 mx-auto w-full max-w-5xl pt-8 sm:pt-12">
        <div className="skeleton mx-auto h-7 w-40 !rounded-md" />
        <div className="skeleton mx-auto mt-7 h-14 w-full max-w-3xl" />
        <Line className="mx-auto mt-6 w-full max-w-xl" />
      </div>

      <div className="relative z-10 mx-auto mt-10 w-full max-w-4xl text-center">
        <Line className="mx-auto w-full max-w-3xl" />
        <Line className="mx-auto mt-2 w-5/6 max-w-2xl" />
        <Line className="mx-auto mt-2 w-2/3 max-w-xl" />
        <div className="skeleton mx-auto mt-8 h-12 w-32 !rounded-lg" />
      </div>

      <div className="relative z-10 mx-auto mt-12 w-full max-w-4xl rounded-2xl border border-[#ffd7b8]/20 bg-[#ffebe0]/[0.038] p-5 sm:p-7">
        <div className="skeleton h-7 w-7 !rounded-lg" />
        <div className="skeleton mt-5 h-6 w-44" />
        <Line className="mt-3 w-full max-w-2xl" />
        <Line className="mt-2 w-5/6 max-w-xl" />
        <Line className="mt-2 w-2/3 max-w-lg" />
        <div className="mt-6 w-full max-w-md">
          <Line className="w-40" />
          <div className="skeleton mt-2 h-11 w-full !rounded-lg" />
          <div className="skeleton mt-4 h-11 w-full !rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function ReportSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8"
      aria-busy="true"
      aria-label="Loading report"
    >
      <RouteProgress />
      <Line className="w-24" />
      <div className="skeleton mt-3 h-8 w-80" />
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="surface p-5">
            <Line className="w-20" />
            <div className="skeleton mt-4 h-8 w-16" />
          </div>
        ))}
      </div>
      <CardSkeleton className="mt-4" lines={5} />
      <CardSkeleton className="mt-4" lines={4} />
    </div>
  );
}

/**
 * Practice: Maya's column beside the session intro, then the chapter list.
 * The avatar box keeps its full height so the page does not lurch when the
 * 3D stage finishes loading.
 */
export function PracticeSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-[95rem] px-5 pb-16 sm:px-8 lg:px-10"
      aria-busy="true"
      aria-label="Loading practice"
    >
      <RouteProgress />
      <div className="py-6">
        <Line className="w-44" />
      </div>

      <section className="rounded-[1.5rem] bg-[#3557b4] p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <div className="min-h-[22rem] rounded-2xl bg-[#2a4aa0] p-5 lg:min-h-[28rem]">
            <div className="flex items-center gap-2.5">
              <div className="skeleton h-8 w-8 !rounded-lg" />
              <div className="space-y-2">
                <Line className="w-16" />
                <Line className="w-28" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#2a4aa0] p-5 sm:p-7">
            <div className="flex gap-2">
              <div className="skeleton h-6 w-28 !rounded-md" />
              <div className="skeleton h-6 w-36 !rounded-md" />
            </div>
            <div className="skeleton mt-4 h-10 w-72" />
            <div className="mt-4 space-y-2.5">
              <Line className="w-full" />
              <Line className="w-11/12" />
              <Line className="w-3/5" />
            </div>
            <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="space-y-2">
                  <Line className="w-16" />
                  <div className="skeleton h-6 w-14" />
                </div>
              ))}
            </div>
            <div className="skeleton mt-8 h-12 w-56 !rounded-xl" />
          </div>
        </div>
      </section>

      <div className="mt-4 grid gap-3">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="rounded-2xl bg-[#2a4aa0] p-5">
            <div className="flex items-start gap-4">
              <div className="skeleton h-10 w-10 !rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2.5">
                <Line className="w-52" />
                <Line className="w-full max-w-xl" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Progress: hero with the completion ring, then the chart rows beneath it. */
export function ProgressSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-[95rem] px-5 pb-16 sm:px-8 lg:px-10"
      aria-busy="true"
      aria-label="Loading progress"
    >
      <RouteProgress />

      <section className="mt-6 rounded-[1.5rem] bg-[#3557b4] p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(19rem,0.7fr)]">
          <div className="rounded-2xl bg-[#2a4aa0] p-5 sm:p-7">
            <div className="skeleton h-6 w-32 !rounded-md" />
            <div className="skeleton mt-4 h-10 w-96 max-w-full" />
            <div className="mt-4 space-y-2.5">
              <Line className="w-full max-w-2xl" />
              <Line className="w-2/3 max-w-xl" />
            </div>
            <div className="mt-6 flex gap-2.5">
              <div className="skeleton h-12 w-64 !rounded-xl" />
              <div className="skeleton h-12 w-44 !rounded-xl" />
            </div>
            <div className="skeleton mt-4 h-[4.5rem] w-full !rounded-xl" />
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="skeleton h-[5.5rem] w-full !rounded-xl" />
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center rounded-2xl bg-[#2a4aa0] p-5 sm:p-6">
            <Line className="w-full max-w-[10rem] self-start" />
            <div className="skeleton mt-4 h-44 w-44 !rounded-full" />
            <div className="mt-5 w-full space-y-2.5">
              {Array.from({ length: 4 }, (_, index) => (
                <Line key={index} className="w-full" />
              ))}
            </div>
            <div className="mt-5 grid w-full grid-cols-2 gap-2.5">
              <div className="skeleton h-14 w-full !rounded-xl" />
              <div className="skeleton h-14 w-full !rounded-xl" />
            </div>
          </div>
        </div>
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(19rem,0.75fr)]">
        <ChartCardSkeleton height="h-40" />
        <ChartCardSkeleton height="h-40" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <ChartCardSkeleton height="h-48" />
        <ChartCardSkeleton height="h-48" />
      </div>
    </div>
  );
}

/** Reports: hero with the latest-round card, then trend, matrix and the list. */
export function ReportsSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-[95rem] px-5 pb-16 sm:px-8 lg:px-10"
      aria-busy="true"
      aria-label="Loading reports"
    >
      <RouteProgress />

      <section className="mt-6 rounded-[1.5rem] bg-[#3557b4] p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(19rem,0.7fr)]">
          <div className="rounded-2xl bg-[#2a4aa0] p-5 sm:p-7">
            <div className="skeleton h-6 w-28 !rounded-md" />
            <div className="skeleton mt-4 h-10 w-[26rem] max-w-full" />
            <div className="mt-4 space-y-2.5">
              <Line className="w-full max-w-2xl" />
              <Line className="w-3/4 max-w-xl" />
            </div>
            <div className="mt-6 flex gap-2.5">
              <div className="skeleton h-12 w-56 !rounded-xl" />
              <div className="skeleton h-12 w-44 !rounded-xl" />
            </div>
            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="skeleton h-[5.5rem] w-full !rounded-xl" />
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-[#2a4aa0] p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <Line className="w-24" />
              <div className="skeleton h-5 w-20 !rounded-full" />
            </div>
            <div className="mt-4 flex items-center gap-5">
              <div className="skeleton h-[6.5rem] w-[6.5rem] !rounded-full" />
              <div className="min-w-0 flex-1 space-y-2.5">
                <Line className="w-40" />
                <Line className="w-32" />
              </div>
            </div>
            <div className="mt-5 space-y-2.5">
              <Line className="w-full" />
              <Line className="w-full" />
            </div>
            <div className="skeleton mt-4 h-16 w-full !rounded-xl" />
            <div className="skeleton mt-4 h-11 w-full !rounded-xl" />
          </div>
        </div>
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(19rem,0.8fr)]">
        <ChartCardSkeleton height="h-40" />
        <ChartCardSkeleton height="h-56" />
      </div>

      <div className="mt-4">
        <ChartCardSkeleton height="h-52" />
      </div>

      <div className="mt-4 grid gap-3">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="rounded-xl bg-[#2a4aa0] p-4">
            <div className="flex items-start gap-4">
              <div className="skeleton h-11 w-11 !rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2.5">
                <Line className="w-56" />
                <Line className="w-full max-w-xl" />
                <Line className="w-40" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartCardSkeleton({ height }: { height: string }) {
  return (
    <section className="rounded-2xl bg-[#2a4aa0] p-5 sm:p-6">
      <div className="space-y-2.5 border-b border-cream/[0.09] pb-4">
        <div className="skeleton h-6 w-40" />
        <Line className="w-64 max-w-full" />
      </div>
      <div className={`skeleton mt-4 w-full !rounded-xl ${height}`} />
    </section>
  );
}

/** A single question: header, problem column, and Maya's coach rail. */
export function QuestionSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-[95rem] px-5 pb-16 sm:px-8 lg:px-10"
      aria-busy="true"
      aria-label="Loading question"
    >
      <RouteProgress />
      <div className="py-6">
        <Line className="w-52" />
      </div>

      <section className="rounded-[1.5rem] bg-[#3557b4] p-4 sm:p-5">
        <div className="rounded-2xl bg-[#2a4aa0] p-5 sm:p-7">
          <div className="flex flex-wrap gap-2.5">
            <div className="skeleton h-7 w-20 !rounded-md" />
            <div className="skeleton h-7 w-24 !rounded-md" />
            <div className="skeleton h-7 w-32 !rounded-md" />
          </div>
          <div className="skeleton mt-4 h-11 w-96 max-w-full" />
          <div className="mt-4 space-y-2.5">
            <Line className="w-full max-w-3xl" />
            <Line className="w-4/5 max-w-2xl" />
          </div>
          <div className="skeleton mt-6 h-[4.5rem] w-full !rounded-2xl" />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
          <div className="space-y-4">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="rounded-2xl bg-[#2a4aa0] p-5 sm:p-6">
                <Line className="w-28" />
                <div className="mt-4 space-y-2.5">
                  <Line className="w-full" />
                  <Line className="w-11/12" />
                  <Line className="w-2/3" />
                </div>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-2xl bg-[#2a4aa0]">
            <div className="h-[15rem] bg-[#26449d] p-4">
              <div className="flex items-center gap-2.5">
                <div className="skeleton h-8 w-8 !rounded-lg" />
                <div className="space-y-2">
                  <Line className="w-16" />
                  <Line className="w-32" />
                </div>
              </div>
            </div>
            <div className="p-5">
              <Line className="w-24" />
              <div className="skeleton mt-3 h-5 w-36" />
              <div className="skeleton mt-5 h-11 w-full !rounded-xl" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/** A chapter session: Maya on the left, her briefing beat on the right. */
export function ChapterSessionSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-[95rem] px-5 pb-16 sm:px-8 lg:px-10"
      aria-busy="true"
      aria-label="Loading session"
    >
      <RouteProgress />
      <div className="py-6">
        <Line className="w-56" />
      </div>

      <section className="rounded-[1.5rem] bg-[#3557b4] p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <div className="min-h-[26rem] rounded-2xl bg-[#2a4aa0] p-5 lg:min-h-[34rem]">
            <div className="flex items-center gap-2.5">
              <div className="skeleton h-8 w-8 !rounded-lg" />
              <div className="space-y-2">
                <Line className="w-16" />
                <Line className="w-32" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#2a4aa0] p-5 sm:p-6">
            <div className="flex gap-1.5">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="skeleton h-1.5 w-6 !rounded-full" />
              ))}
            </div>
            <div className="mt-7 space-y-3">
              <Line className="w-24" />
              <div className="skeleton h-9 w-80 max-w-full" />
              <Line className="w-full max-w-2xl" />
              <Line className="w-3/4 max-w-xl" />
            </div>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="skeleton h-14 w-full !rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="rounded-2xl bg-[#2a4aa0] p-5">
            <Line className="w-20" />
            <div className="skeleton mt-3 h-7 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
