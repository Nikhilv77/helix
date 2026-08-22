import { RouteProgress } from "@/components/workspace/shared/loading/primitives";

function Line({ className = "" }: { className?: string }) {
  return <div className={`skeleton h-3 ${className}`} />;
}

export function ProfileSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-[84rem] px-4 pb-20 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pt-10"
      aria-busy="true"
      aria-label="Loading profile"
    >
      <RouteProgress />
      <header className="profile-motion relative overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-[#151619]">
        <div className="relative px-5 py-6 sm:px-7 sm:py-7 lg:px-8">
          <div className="flex flex-col items-center text-center">
            <span className="relative grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-full bg-[#f5f3ef] p-0.5 sm:h-32 sm:w-32">
              <div className="profile-image-skeleton h-full w-full rounded-full" />
            </span>
            <div className="mt-3 flex w-full flex-col items-center">
              <div className="skeleton h-7 w-44 !rounded-md" />
              <div className="skeleton mt-3 h-10 w-80 max-w-full" />
              <Line className="mt-4 w-full max-w-3xl" />
              <Line className="mt-2 w-2/3 max-w-xl" />
              <div className="mt-4 flex flex-wrap justify-center gap-2.5">
                <div className="skeleton h-9 w-28 !rounded-full" />
                <div className="skeleton h-9 w-28 !rounded-full" />
              </div>
              <div className="mt-8 h-px w-full max-w-5xl bg-gradient-to-r from-transparent via-white/15 to-transparent" />
              <div className="mt-7 w-full max-w-4xl space-y-3">
                <Line className="mx-auto w-full" />
                <Line className="mx-auto w-11/12" />
                <Line className="mx-auto w-4/5" />
              </div>
              <section className="mt-8 w-full max-w-[82rem]">
                <div className="mx-auto mb-8 h-px w-[calc(100%-2rem)] max-w-6xl bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                <div className="skeleton mx-auto h-7 w-40 !rounded-md" />
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 5 }, (_, index) => (
                    <div
                      key={index}
                      className="step-in min-h-28 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-5 py-4 text-left"
                    >
                      <div className="skeleton h-7 w-40" />
                      <Line className="mt-4 w-full" />
                      <Line className="mt-2 w-2/3" />
                    </div>
                  ))}
                </div>
              </section>
              <div className="mt-7 w-full max-w-4xl rounded-2xl border border-white/[0.08] bg-white/[0.025] px-6 py-5 sm:px-8">
                <div className="skeleton mx-auto h-8 w-full max-w-2xl" />
                <div className="skeleton mx-auto mt-2 h-8 w-2/3 max-w-lg" />
              </div>
              <section className="mt-10 w-full max-w-[82rem] text-left">
                <div className="mx-auto h-px w-[calc(100%-2rem)] max-w-6xl bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                <div className="mt-7 flex flex-col items-center text-center">
                  <div className="skeleton h-7 w-36 !rounded-md" />
                  <Line className="mt-4 w-full max-w-xl" />
                </div>
                <div className="mx-auto mt-6 grid w-full max-w-[74rem] gap-4 md:grid-cols-3">
                  {Array.from({ length: 3 }, (_, index) => (
                    <div
                      key={index}
                      className="step-in flex min-h-44 flex-col items-center justify-center rounded-[1.45rem] border border-white/[0.08] bg-white/[0.025] px-6 py-7 text-center"
                    >
                      <div className="skeleton h-11 w-11 !rounded-xl" />
                      <div className="skeleton mt-6 h-7 w-32" />
                      <div className="skeleton mt-4 h-4 w-24" />
                    </div>
                  ))}
                </div>
                <div className="mt-9 space-y-9">
                  <ProfileSkeletonGroup titleWidth="w-16" count={1} />
                  <ProfileSkeletonGroup titleWidth="w-24" count={1} />
                  <ProfileSkeletonGroup titleWidth="w-24" count={3} columns="three" />
                </div>
              </section>
            </div>
          </div>
        </div>
      </header>
      <section className="relative mt-5 overflow-hidden rounded-[1.35rem] border border-white/[0.07] bg-white/[0.025] p-6 sm:p-7">
        <div className="skeleton h-5 w-full max-w-4xl" />
        <div className="skeleton mt-3 h-4 w-48" />
      </section>
    </div>
  );
}

function ProfileSkeletonGroup({
  titleWidth,
  count,
  columns = "two"
}: {
  titleWidth: string;
  count: number;
  columns?: "two" | "three";
}) {
  return (
    <section className="relative overflow-hidden rounded-[1.35rem] p-2 sm:p-3">
      <div className="mb-4 flex items-center gap-4">
        <div className={`skeleton h-6 ${titleWidth}`} />
        <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
      </div>
      <div
        className={["grid gap-4", columns === "three" ? "xl:grid-cols-3" : "xl:grid-cols-2"].join(
          " "
        )}
      >
        {Array.from({ length: count }, (_, index) => (
          <div
            key={index}
            className="min-h-[18rem] rounded-[1.35rem] border border-white/[0.08] bg-white/[0.025] p-5 sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="skeleton h-8 w-8 !rounded-lg" />
              <div className="skeleton h-7 w-28 !rounded-full" />
            </div>
            <div className="skeleton mt-8 h-8 w-3/4" />
            <Line className="mt-4 w-full" />
            <Line className="mt-2 w-4/5" />
            <Line className="mt-6 w-full" />
            <Line className="mt-2 w-2/3" />
            <div className="mt-6 flex flex-wrap gap-2">
              <div className="skeleton h-7 w-24 !rounded-full" />
              <div className="skeleton h-7 w-20 !rounded-full" />
              <div className="skeleton h-7 w-24 !rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
