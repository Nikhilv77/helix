import { MicOff } from "lucide-react";
import { MicMeter } from "@/features/interviews/ui/voice/mic-meter";
import { MicrophonePicker } from "./microphone-picker";

/**
 * Shown in the centre of the room when the interviewer has not heard the
 * candidate at all on the current microphone, so a wrong device is fixed in
 * seconds instead of looking like the interviewer ignoring them.
 */
export function MicrophoneCheckDialog({
  interviewerName,
  devices,
  selectedId,
  track,
  switching,
  onChange,
  onDismiss
}: {
  interviewerName: string;
  devices: MediaDeviceInfo[];
  selectedId: string;
  track: MediaStreamTrack | null;
  switching: boolean;
  onChange: (deviceId: string) => void;
  onDismiss: () => void;
}) {
  return (
    <>
      <div
        aria-hidden="true"
        className="interview-dialog-backdrop pointer-events-none fixed inset-0 z-[80]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="microphone-check-title"
        className="interview-mic-dialog practice-paper fixed left-1/2 top-1/2 z-[81] w-[min(29rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-white/[0.09] bg-[#151619]"
      >
        <div className="p-5 sm:p-6">
          <span className="interview-media-icon mx-auto grid h-11 w-11 place-items-center rounded-xl border border-white/[0.1] text-cream/72">
            <MicOff size={18} strokeWidth={1.5} aria-hidden="true" />
          </span>
          <h2
            id="microphone-check-title"
            className="mt-4 text-center text-xl font-semibold tracking-[-0.02em] text-cream"
          >
            {`${interviewerName} can’t hear you yet`}
          </h2>
          <p className="mt-2 text-center text-sm leading-6 text-cream/58">
            Say something. If the bars below don&apos;t move, choose the microphone you are talking
            into.
          </p>

          <div className="interview-soft-rule mt-5 grid gap-3 pt-4">
            <MicrophonePicker
              devices={devices}
              selectedId={selectedId}
              disabled={switching}
              onChange={onChange}
            />
            <MicMeter track={track} muted={false} />
          </div>

          <button
            type="button"
            onClick={onDismiss}
            className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-full bg-cream px-4 text-sm font-semibold text-[#17181a] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workspace-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#151619]"
          >
            Keep this microphone
          </button>
        </div>
      </aside>
    </>
  );
}
