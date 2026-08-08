import { RouteProgress, Waveform } from "@/components/workspace/skeletons";

/**
 * The fallback for `/` and every route below it without its own.
 *
 * Deliberately neutral. This renders before `auth()` resolves, so it cannot
 * know whether the marketing page, the workspace, the onboarding flow or the
 * bare interview room is on the way — it used to render the workspace
 * dashboard skeleton, which meant a signed-out visitor refreshing the landing
 * page got a flash of cards from a product they had not signed into.
 *
 * It paints its own blueprint surface rather than inheriting from <body>:
 * `body` is the near-black default until the layout resolves auth and adds
 * `.workspace`, so anything transparent here flashes black first.
 */
export default function RootLoading() {
  return (
    <div
      className="blueprint relative grid min-h-[100svh] place-items-center"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="blueprint-glow" />
      <RouteProgress />
      <Waveform className="relative z-10" />
    </div>
  );
}
