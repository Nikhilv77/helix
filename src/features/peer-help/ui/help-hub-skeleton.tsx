/**
 * Page-shaped fallback for the Trailmate hub.
 *
 * Every container here mirrors `HelpHub` — same max width, same padding, same
 * section rhythm (`mt-12 sm:mt-14` for the ranking, `mt-14 sm:mt-16` for the
 * histories), same grid breakpoints. The point of a skeleton is that nothing
 * moves when the real content arrives, so the two files have to be edited
 * together; a generic three-identical-sections placeholder shifted the whole
 * page on swap because the ranking grid is three columns and the histories
 * are two.
 */

function SkeletonLine({ className }: { className: string }) {
  return <span aria-hidden="true" className={`block rounded-full bg-white/[0.055] ${className}`} />;
}

/** Eyebrow, title and description, matching `SectionHeading`. */
function SectionHeadingSkeleton({ titleWidth }: { titleWidth: string }) {
  return (
    <div className="max-w-2xl">
      <SkeletonLine className="h-2 w-24" />
      <SkeletonLine className={`mt-2.5 h-6 ${titleWidth}`} />
      <SkeletonLine className="mt-3 h-2.5 w-full max-w-[26rem]" />
    </div>
  );
}

/** Ranking card: avatar, name, blurb, count pill, then a three-up stat strip. */
function HelperCardSkeleton() {
  return (
    <div className="rounded-[1.25rem] bg-[rgba(20,21,24,0.72)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] sm:p-5">
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden="true"
          className="h-12 w-12 shrink-0 rounded-full bg-white/[0.045] ring-1 ring-white/10"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <SkeletonLine className="h-3.5 w-28" />
            <span
              aria-hidden="true"
              className="h-7 w-9 shrink-0 rounded-full border border-white/[0.11]"
            />
          </div>
          <SkeletonLine className="mt-2.5 h-2 w-full" />
          <SkeletonLine className="mt-1.5 h-2 w-3/5" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 border-t border-white/[0.14] pt-4">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className={`flex flex-col items-center gap-1.5 ${index > 0 ? "border-l border-white/[0.13]" : ""}`}
          >
            <SkeletonLine className="h-3 w-6" />
            <SkeletonLine className="h-1.5 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** History card: peer row, the "Worked through" panel, then a meta footer. */
function ConversationCardSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className="rounded-[1.25rem] bg-[rgba(16,17,20,0.78)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] sm:p-5">
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="h-11 w-11 shrink-0 rounded-full bg-white/[0.045] ring-1 ring-white/10"
        />
        <div className="min-w-0 flex-1">
          <SkeletonLine className={`h-4 ${wide ? "w-40" : "w-32"}`} />
          <SkeletonLine className="mt-2 h-2 w-full max-w-[15rem]" />
        </div>
        <span
          aria-hidden="true"
          className="h-6 w-20 shrink-0 rounded-full border border-white/[0.17]"
        />
      </div>

      <div className="mt-5 rounded-xl border border-white/[0.13] bg-white/[0.018] p-3.5">
        <SkeletonLine className="h-1.5 w-24" />
        <div className="mt-2.5 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <SkeletonLine className={`h-3.5 ${wide ? "w-48" : "w-36"} max-w-full`} />
            <SkeletonLine className="mt-2 h-2 w-28" />
          </div>
          <span
            aria-hidden="true"
            className="h-9 w-9 shrink-0 rounded-full border border-white/[0.18]"
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <SkeletonLine className="h-2 w-32" />
        <SkeletonLine className="h-2 w-16" />
      </div>
    </div>
  );
}

export function HelpHubSkeleton() {
  return (
    <main
      className="mx-auto w-full max-w-[88rem] animate-pulse px-4 pb-24 pt-8 sm:px-8 sm:pt-10 lg:px-10"
      aria-busy="true"
      aria-label="Loading Trailmate"
    >
      {/* UserRecognition */}
      <header className="flex flex-col items-center border-b border-white/[0.14] pb-10 sm:pb-12">
        <span
          aria-hidden="true"
          className="h-24 w-24 rounded-full bg-[#17181b] shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] sm:h-28 sm:w-28"
        />
        <SkeletonLine className="mt-4 h-4 w-36" />
        <SkeletonLine className="mt-2.5 h-2 w-24" />
        <span
          aria-hidden="true"
          className="mt-4 h-9 w-36 rounded-full border border-white/[0.2] bg-black"
        />
      </header>

      {/* TopHelpers — three across at xl, so three cards fill the row exactly */}
      <section className="mt-12 sm:mt-14" aria-label="Loading community ranking">
        <SectionHeadingSkeleton titleWidth="w-52" />
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <HelperCardSkeleton key={index} />
          ))}
        </div>
      </section>

      {/* Two RelationshipHistory sections, two columns each */}
      {[
        { key: "given", title: "w-64" },
        { key: "received", title: "w-56" }
      ].map((section) => (
        <section
          key={section.key}
          className="mt-14 sm:mt-16"
          aria-label="Loading conversation history"
        >
          <SectionHeadingSkeleton titleWidth={section.title} />
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            <ConversationCardSkeleton wide />
            <ConversationCardSkeleton />
          </div>
        </section>
      ))}
    </main>
  );
}
