function Line({ className = "" }: { className?: string }) {
  return <span className={`block rounded-full bg-white/[0.065] ${className}`} />;
}

function SessionIntroSkeleton() {
  return (
    <>
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <Line className="h-8 w-64 max-w-full" />
          <Line className="mt-4 h-3 w-80 max-w-full" />
        </div>
        <div className="w-full rounded-xl border border-white/[0.08] bg-[#141619] px-5 py-4 sm:max-w-[19rem]">
          <Line className="h-4 w-48 max-w-full" />
          <Line className="mt-3 h-3 w-32" />
          <Line className="mt-4 h-1.5 w-full" />
        </div>
      </header>
      <div className="relative mt-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#141619] sm:mt-7 md:min-h-[13.5rem]">
        <div className="h-[17rem] bg-white/[0.025] md:absolute md:inset-y-0 md:right-0 md:h-auto md:w-[45%]" />
        <div className="relative space-y-3 px-5 py-7 sm:px-7 md:max-w-[55%] md:py-9">
          <Line className="h-3 w-24" />
          <Line className="h-7 w-72 max-w-full" />
          <Line className="h-3 w-full max-w-sm" />
          <Line className="h-3 w-4/5 max-w-xs" />
          <Line className="!mt-5 h-11 w-40 rounded-lg" />
        </div>
      </div>
    </>
  );
}

function LibrarySkeleton() {
  return (
    <section className="mt-9">
      <Line className="h-3 w-48" />
      <Line className="mt-3 h-3 w-full max-w-[34rem]" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="rounded-[1.4rem] border border-white/[0.08] bg-[#17181b] p-5 sm:p-6"
          >
            <div className="flex items-center gap-4">
              <Line className="h-10 w-10 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1">
                <Line className="h-5 w-56 max-w-full" />
                <Line className="mt-3 h-3 w-36" />
              </div>
              <Line className="hidden h-7 w-20 sm:block" />
            </div>
            {index === 0 ? (
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                {Array.from({ length: 4 }, (_, question) => (
                  <div
                    key={question}
                    className="flex items-center gap-3 rounded-xl bg-black/20 p-3.5"
                  >
                    <Line className="h-8 w-8 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <Line className="h-3 w-4/5" />
                      <Line className="mt-2 h-3 w-2/5" />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

/** Mirrors the story overview; AI/ML shows its library directly below the intro. */
export function StoryPracticeSessionSkeleton({ libraryOnly = false }: { libraryOnly?: boolean }) {
  return (
    <main
      className="practice-skeleton practice-page min-h-[100svh] w-full bg-black"
      aria-busy="true"
      aria-label="Loading practice session"
    >
      <div className="mx-auto w-full max-w-[86rem] px-4 pb-20 pt-7 motion-safe:animate-pulse sm:px-7 sm:pt-9 lg:px-8 lg:pt-8">
        <div aria-hidden="true" className="h-9 w-36 rounded-lg bg-white/[0.055]" />
        <div
          aria-hidden="true"
          className={
            libraryOnly
              ? "mx-auto mt-5 max-w-[68rem]"
              : "mt-5 grid gap-7 xl:grid-cols-[minmax(0,1fr)_17rem] xl:gap-x-14"
          }
        >
          <div className="min-w-0">
            <SessionIntroSkeleton />
            {libraryOnly ? (
              <LibrarySkeleton />
            ) : (
              <>
                <section className="mt-7 rounded-[1.4rem] bg-[#17181b] p-5 sm:p-6">
                  <Line className="h-5 w-40" />
                  <Line className="mt-4 h-3 w-full max-w-[32rem]" />
                  <Line className="mt-3 h-2 w-full" />
                  <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
                    {Array.from({ length: 4 }, (_, question) => (
                      <div
                        key={question}
                        className="flex items-center gap-3 rounded-xl bg-black/20 p-4"
                      >
                        <Line className="h-9 w-9 shrink-0 rounded-lg" />
                        <div className="min-w-0 flex-1">
                          <Line className="h-4 w-4/5" />
                          <Line className="mt-3 h-3 w-2/5" />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
                <LibrarySkeleton />
              </>
            )}
          </div>
          {!libraryOnly ? (
            <aside className="hidden rounded-[1.45rem] border border-white/[0.08] bg-[#141619] p-5 xl:mt-[9.3rem] xl:block">
              <Line className="h-5 w-40" />
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="mt-5 flex gap-3">
                  <Line className="h-4 w-5 shrink-0" />
                  <Line className="h-4 w-full" />
                </div>
              ))}
            </aside>
          ) : null}
        </div>
      </div>
    </main>
  );
}

/** Shared two-pane loading state for Core, Applied, Architecture, and AI/ML questions. */
export function StoryPracticeQuestionSkeleton() {
  return (
    <main
      className="practice-skeleton practice-question-page w-full bg-black p-2 sm:p-3 xl:h-[calc(100svh-4.25rem)] xl:overflow-hidden"
      aria-busy="true"
      aria-label="Loading practice question"
    >
      <div
        aria-hidden="true"
        className="mx-auto flex min-h-0 w-full max-w-[112rem] flex-col gap-2 motion-safe:animate-pulse xl:h-full"
      >
        <header className="flex shrink-0 flex-wrap items-center gap-3 rounded-xl border border-white/[0.08] bg-[#141619] px-3 py-2.5 sm:px-4">
          <Line className="h-9 w-9 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1">
            <Line className="h-4 w-52 max-w-full" />
            <div className="mt-2 flex gap-1.5">
              <Line className="h-5 w-16 rounded-md" />
              <Line className="h-5 w-14 rounded-md" />
              <Line className="h-5 w-20 rounded-md" />
            </div>
          </div>
          <Line className="h-9 w-28 rounded-lg" />
        </header>

        <div className="grid min-h-0 flex-1 gap-2 xl:grid-cols-[minmax(22rem,0.82fr)_minmax(34rem,1.18fr)]">
          <section className="min-h-[32rem] overflow-hidden rounded-xl border border-white/[0.08] bg-[#141619] xl:min-h-0">
            <div className="flex h-[3.25rem] items-end gap-4 border-b border-white/[0.07] px-5 pb-3">
              <Line className="h-3 w-24" />
              <Line className="h-3 w-16" />
            </div>
            <div className="space-y-6 p-5 sm:p-6">
              <div className="rounded-2xl border border-white/[0.07] bg-[#101214] p-5">
                <Line className="h-3 w-32" />
                <Line className="mt-4 h-7 w-4/5" />
                <Line className="mt-5 h-3 w-full" />
                <Line className="mt-2 h-3 w-11/12" />
                <Line className="mt-2 h-3 w-3/4" />
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-[#101214] p-5">
                <Line className="h-3 w-28" />
                <Line className="mt-4 h-3 w-full" />
                <Line className="mt-2 h-3 w-4/5" />
              </div>
            </div>
          </section>

          <section className="flex min-h-[34rem] flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#101214] xl:min-h-0">
            <div className="flex h-12 items-center justify-between gap-3 bg-[#141619] px-4">
              <Line className="h-3 w-44" />
              <Line className="h-3 w-20" />
            </div>
            <div className="flex h-12 items-center border-b border-white/[0.07] px-4">
              <Line className="h-4 w-40" />
            </div>
            <div className="flex-1 p-4 sm:p-5">
              <Line className="h-3 w-2/3" />
              <Line className="mt-3 h-3 w-1/2" />
              <div className="mt-6 min-h-48 rounded-xl border border-white/[0.07] bg-[#141619] p-4">
                <Line className="h-3 w-4/5" />
                <Line className="mt-3 h-3 w-3/5" />
              </div>
            </div>
            <div className="flex h-16 items-center justify-between border-t border-white/[0.07] bg-[#141619] px-4">
              <Line className="h-3 w-24" />
              <Line className="h-10 w-28 rounded-lg" />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
