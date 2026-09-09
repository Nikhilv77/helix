"use client";

import { CameraOff, ShieldCheck } from "lucide-react";
import { useEffect, useRef } from "react";
import { INTERVIEW_PANEL_RULE } from "./panel-surface";

export function CandidateCameraPreview({
  stream,
  onDisable
}: {
  stream: MediaStream;
  onDisable: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.srcObject = stream;
    void video.play().catch(() => undefined);

    const track = stream.getVideoTracks()[0];
    const handleEnded = () => onDisable();
    track?.addEventListener("ended", handleEnded, { once: true });

    return () => {
      track?.removeEventListener("ended", handleEnded);
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [onDisable, stream]);

  return (
    <section
      aria-label="Your camera preview"
      className={`border-t ${INTERVIEW_PANEL_RULE} p-3`}
    >
      <div className="group relative aspect-video overflow-hidden rounded-xl border border-white/[0.09] bg-[#090a0c] shadow-[inset_0_1px_0_rgba(255,255,255,0.045),0_14px_35px_rgba(0,0,0,0.24)]">
        <video
          ref={videoRef}
          muted
          autoPlay
          playsInline
          aria-label="Mirrored self-view camera preview"
          className="h-full w-full scale-x-[-1] object-cover"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/20" />

        <div className="absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-sm font-medium text-cream/78 backdrop-blur-md">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--workspace-accent)] shadow-[0_0_8px_var(--workspace-accent)]" />
          Self view
        </div>

        <div className="absolute inset-x-2.5 bottom-2.5 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm text-cream/64">
            <ShieldCheck size={13} aria-hidden="true" />
            Preview only
          </span>
          <button
            type="button"
            onClick={onDisable}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-black/55 px-2.5 text-sm font-medium text-cream/74 backdrop-blur-md transition hover:border-white/20 hover:bg-black/70 hover:text-cream"
          >
            <CameraOff size={13} aria-hidden="true" />
            Off
          </button>
        </div>
      </div>
    </section>
  );
}
