import { RouteProgress, Waveform } from "@/components/workspace/shared/loading/primitives";

export function MayaWelcomeLoading() {
  return (
    <div
      className="profile-theme relative grid min-h-[100svh] place-items-center overflow-hidden"
      aria-busy="true"
      aria-label="Loading Maya introduction"
    >
      <RouteProgress />
      <Waveform className="relative z-10" />
    </div>
  );
}
