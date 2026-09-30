/**
 * The root boundary can be reused while navigating between routes. Its request
 * headers can still describe the previous route, so it must not choose a page
 * skeleton from the pathname. Each route owns its page-specific loading UI.
 */

import { RootLoadingSurface } from "./root-loading-surface";

/** Root fallback shared by the public home and signed-in workspace routes. */
export default function RootLoading() {
  return <RootLoadingSurface fallback={<UnknownRouteSkeleton />} />;
}

/** No placeholder layout: just a quiet spinner, centred on the page colour. */
function UnknownRouteSkeleton() {
  return (
    <div
      className="app-root-loader app-root-spinner grid min-h-[100svh] place-items-center"
      aria-busy="true"
      aria-label="Loading page"
    >
      <span aria-hidden="true" className="app-root-spinner-ring block h-7 w-7 rounded-full" />
    </div>
  );
}
