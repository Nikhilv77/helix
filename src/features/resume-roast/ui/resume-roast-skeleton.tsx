import { INTERVIEW_PANEL_SHELL } from "@/features/interviews/ui/voice/components/panel-surface";

function Block({ className = "" }: { className?: string }) {
  return <span className={`skeleton block ${className}`} />;
}

/** The same three surfaces as the resume room, before its saved state arrives. */
export function ResumeRoastLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading Resume Roast"
      className="resume-roast-skeleton h-[calc(100dvh-4.25rem)] w-full overflow-hidden bg-black px-3 py-3 sm:px-5"
    >
      <div
        aria-hidden="true"
        className="thin-scroll mx-auto flex h-full w-full max-w-[96rem] min-h-0 flex-col gap-3 overflow-y-auto pb-3 xl:grid xl:grid-cols-[minmax(0,23rem)_minmax(0,1fr)_19rem] xl:overflow-hidden xl:pb-0"
      >
        <section
          className={`${INTERVIEW_PANEL_SHELL} resume-roast-skeleton-panel flex min-h-[24rem] min-w-0 flex-col overflow-hidden xl:min-h-0`}
        >
          <div className="resume-roast-skeleton-rule flex h-14 shrink-0 items-center gap-3 border-b px-4">
            <Block className="h-5 w-5 !rounded-md" />
            <Block className="h-3 w-36" />
          </div>
          <div className="resume-roast-skeleton-document min-h-0 flex-1 p-3.5">
            <div className="resume-roast-skeleton-sheet mx-auto min-h-full max-w-[34rem] rounded-xl px-6 py-8 sm:px-8">
              <Block className="h-5 w-3/5" />
              <Block className="mt-3 h-2.5 w-4/5" />
              <div className="resume-roast-skeleton-rule my-7 border-t" />
              {[0, 1, 2].map((group) => (
                <div key={group} className="mb-8 space-y-3">
                  <Block className="h-2.5 w-1/3" />
                  <Block className="h-2.5 w-full" />
                  <Block className="h-2.5 w-11/12" />
                  <Block className="h-2.5 w-3/4" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          className={`${INTERVIEW_PANEL_SHELL} resume-roast-skeleton-panel resume-roast-skeleton-chat flex min-h-[32rem] min-w-0 flex-col overflow-hidden xl:min-h-0`}
        >
          <div className="resume-roast-skeleton-rule flex h-[4.65rem] shrink-0 items-center justify-between border-b px-5">
            <div className="space-y-2">
              <Block className="h-2.5 w-24" />
              <Block className="h-4 w-32" />
            </div>
            <Block className="h-7 w-24 !rounded-full" />
          </div>
          <div className="min-h-0 flex-1 px-5 py-7 sm:px-8 sm:py-9">
            <div className="mx-auto max-w-2xl space-y-8">
              <div className="flex items-start gap-3">
                <Block className="h-9 w-9 shrink-0 !rounded-full" />
                <div className="resume-roast-skeleton-message w-full max-w-[26rem] rounded-2xl p-4">
                  <Block className="h-2.5 w-full" />
                  <Block className="mt-2.5 h-2.5 w-5/6" />
                  <Block className="mt-2.5 h-2.5 w-2/3" />
                </div>
              </div>
              <div className="ml-12 space-y-4">
                <Block className="h-4 w-2/3" />
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {[0, 1, 2, 3].map((option) => (
                    <div key={option} className="resume-roast-skeleton-choice rounded-xl p-3.5">
                      <Block className="h-2.5 w-4/5" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside
          className={`${INTERVIEW_PANEL_SHELL} resume-roast-skeleton-panel flex min-h-[28rem] shrink-0 flex-col overflow-hidden xl:min-h-0 xl:shrink`}
        >
          <div className="resume-roast-skeleton-stage resume-roast-skeleton-rule flex h-40 shrink-0 items-end border-b p-4">
            <Block className="h-7 w-20 !rounded-full" />
          </div>
          <div className="space-y-4 p-3.5">
            {[0, 1, 2].map((entry) => (
              <div key={entry} className="resume-roast-skeleton-message rounded-xl p-3">
                <Block className="h-2 w-14" />
                <Block className="mt-3 h-2.5 w-full" />
                <Block className="mt-2 h-2.5 w-3/4" />
              </div>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
