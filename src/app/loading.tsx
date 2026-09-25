/**
 * The root boundary can be reused while navigating between routes. Its request
 * headers can still describe the previous route, so it must not choose a page
 * skeleton from the pathname. Each route owns its page-specific loading UI.
 */

/** Root fallback shared by the public home and signed-in workspace routes. */
export default function RootLoading() {
  return <UnknownRouteSkeleton />;
}

function UnknownRouteSkeleton() {
  return (
    <div
      className="app-root-loader blueprint relative min-h-[100svh] px-4 pb-20 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pt-10"
      aria-busy="true"
      aria-label="Loading page"
    >
      <div className="mx-auto w-full max-w-[84rem]">
        <div className="skeleton h-7 w-44" />
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:gap-5">
          <div className="app-root-loader-panel min-h-[16rem] rounded-[1.65rem] p-6">
            <div className="skeleton h-5 w-2/5" />
            <div className="skeleton mt-8 h-3 w-4/5" />
            <div className="skeleton mt-3 h-3 w-3/5" />
          </div>
          <div className="app-root-loader-panel min-h-[16rem] rounded-[1.65rem] p-6">
            <div className="skeleton h-5 w-3/5" />
            <div className="skeleton mt-8 h-3 w-full" />
            <div className="skeleton mt-3 h-3 w-4/5" />
          </div>
        </div>
      </div>
    </div>
  );
}
