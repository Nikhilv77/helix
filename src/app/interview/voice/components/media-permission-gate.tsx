"use client";

import { ArrowRight, Camera, CameraOff, Check, Loader2, Mic, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type PermissionState = "idle" | "requesting" | "ready" | "skipped" | "error";

export type MediaSetupResult = {
  cameraStream: MediaStream | null;
  microphoneDeviceId: string;
};

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function permissionError(error: unknown, kind: "microphone" | "camera") {
  const fallback = `Your ${kind} could not start. Check the browser permission and try again.`;
  if (!(error instanceof DOMException)) return fallback;

  if (error.name === "NotAllowedError" || error.name === "SecurityError") {
    return `${kind === "camera" ? "Camera" : "Microphone"} access is blocked in this browser.`;
  }
  if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
    return `No ${kind} was found on this device.`;
  }
  if (error.name === "NotReadableError" || error.name === "TrackStartError") {
    return `Your ${kind} is currently being used by another app.`;
  }
  return fallback;
}

export function MediaPermissionGate({
  cameraOptional,
  onComplete
}: {
  cameraOptional: boolean;
  onComplete: (result: MediaSetupResult) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const transferredCameraRef = useRef(false);
  const [microphoneState, setMicrophoneState] = useState<PermissionState>("idle");
  const [cameraState, setCameraState] = useState<PermissionState>(
    cameraOptional ? "idle" : "skipped"
  );
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [microphoneLabel, setMicrophoneLabel] = useState("Permission needed");
  const [cameraLabel, setCameraLabel] = useState(
    cameraOptional ? "Optional self view" : "Not used in this round"
  );
  const [error, setError] = useState<string | null>(null);

  const releaseMicrophone = useCallback(() => {
    stopStream(microphoneStreamRef.current);
    microphoneStreamRef.current = null;
  }, []);

  const releaseCamera = useCallback(() => {
    stopStream(cameraStreamRef.current);
    cameraStreamRef.current = null;
    setCameraStream(null);
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const requestCamera = useCallback(async () => {
    setError(null);
    setCameraState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 960 },
          height: { ideal: 540 }
        }
      });
      releaseCamera();
      cameraStreamRef.current = stream;
      setCameraStream(stream);
      setCameraLabel(stream.getVideoTracks()[0]?.label || "Camera ready");
      setCameraState("ready");
      setError(null);
    } catch (caught) {
      releaseCamera();
      setCameraLabel("Camera skipped — you can still continue");
      setCameraState("error");
      setError(permissionError(caught, "camera"));
    }
  }, [releaseCamera]);

  const requestAccess = useCallback(
    async (includeCamera: boolean) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMicrophoneState("error");
        setError("Media access is not supported in this browser.");
        return;
      }

      setError(null);
      releaseMicrophone();
      setMicrophoneState("requesting");
      setCameraState(includeCamera && cameraOptional ? "requesting" : "skipped");
      if (!includeCamera || !cameraOptional) {
        releaseCamera();
        setCameraLabel(cameraOptional ? "Skipped for this interview" : "Not used in this round");
      }

      try {
        const microphoneStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false
        });
        microphoneStreamRef.current = microphoneStream;
        setMicrophoneLabel(microphoneStream.getAudioTracks()[0]?.label || "Microphone ready");
        setMicrophoneState("ready");
      } catch (caught) {
        setMicrophoneState("error");
        setCameraState(cameraOptional ? "idle" : "skipped");
        setError(permissionError(caught, "microphone"));
        return;
      }

      if (includeCamera && cameraOptional) await requestCamera();
    },
    [cameraOptional, releaseCamera, releaseMicrophone, requestCamera]
  );

  const skipCamera = useCallback(() => {
    releaseCamera();
    setCameraState("skipped");
    setCameraLabel("Skipped for this interview");
    setError(null);
  }, [releaseCamera]);

  const enterInterview = useCallback(() => {
    if (microphoneState !== "ready" || !microphoneStreamRef.current) return;

    const microphoneDeviceId =
      microphoneStreamRef.current.getAudioTracks()[0]?.getSettings().deviceId ?? "";
    releaseMicrophone();

    const preparedCamera = cameraState === "ready" ? cameraStreamRef.current : null;
    transferredCameraRef.current = Boolean(preparedCamera);
    onComplete({ cameraStream: preparedCamera, microphoneDeviceId });
  }, [cameraState, microphoneState, onComplete, releaseMicrophone]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !cameraStream) return;
    video.srcObject = cameraStream;
    void video.play().catch(() => undefined);
  }, [cameraStream]);

  useEffect(
    () => () => {
      stopStream(microphoneStreamRef.current);
      if (!transferredCameraRef.current) stopStream(cameraStreamRef.current);
    },
    []
  );

  const requesting = microphoneState === "requesting" || cameraState === "requesting";
  const microphoneReady = microphoneState === "ready";

  return (
    <div className="relative flex min-h-0 w-full flex-1 items-start justify-center overflow-x-hidden overflow-y-auto overscroll-contain px-0 py-3 [scrollbar-gutter:stable] sm:px-5 sm:py-8 md:items-center">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[32rem] w-[42rem] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--workspace-accent)] opacity-[0.075] blur-[130px]" />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-setup-title"
        className="relative mx-auto grid w-full min-w-0 max-w-[calc(100vw-2rem)] shrink-0 overflow-hidden rounded-[1.35rem] border border-white/[0.08] bg-[rgba(18,19,22,0.78)] shadow-[inset_0_1px_0_rgba(255,255,255,0.055),0_32px_100px_rgba(0,0,0,0.46)] backdrop-blur-2xl sm:max-w-5xl sm:rounded-[1.75rem] lg:grid-cols-[minmax(17rem,0.78fr)_minmax(0,1.22fr)]"
      >
        <div className="relative aspect-[16/9] min-h-0 overflow-hidden bg-black/25 sm:min-h-64 lg:aspect-auto lg:min-h-[32rem]">
          {cameraStream ? (
            <video
              ref={videoRef}
              muted
              autoPlay
              playsInline
              className="absolute inset-0 h-full w-full scale-x-[-1] object-cover"
              aria-label="Camera setup preview"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
              {requesting ? (
                <Loader2
                  size={40}
                  className="animate-spin text-[var(--workspace-accent)]"
                  aria-hidden="true"
                />
              ) : (
                <div className="flex items-center gap-4 text-cream/72">
                  <Mic size={32} strokeWidth={1.5} aria-hidden="true" />
                  <span className="h-8 w-px bg-white/10" />
                  {cameraOptional ? (
                    <Camera size={36} strokeWidth={1.5} aria-hidden="true" />
                  ) : (
                    <ShieldCheck size={36} strokeWidth={1.5} aria-hidden="true" />
                  )}
                </div>
              )}
              <p className="mt-6 max-w-xs text-base leading-7 text-cream/52">
                {requesting
                  ? "Your browser may ask you to confirm access now."
                  : cameraOptional
                    ? "Check your voice and framing before Maya joins."
                    : "Check your voice before Maya joins."}
              </p>
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/15" />
          <div className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-sm text-cream/72 backdrop-blur-xl sm:bottom-4 sm:left-4">
            <ShieldCheck size={14} aria-hidden="true" />
            Not recorded
          </div>
        </div>

        <div className="flex min-w-0 flex-col p-5 sm:p-8 lg:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-cream/42">
            Before Maya joins
          </p>
          <h1 id="media-setup-title" className="mt-2.5 text-[1.75rem] font-semibold leading-tight tracking-[-0.035em] text-cream sm:mt-3 sm:text-4xl">
            Set up your interview.
          </h1>
          <p className="mt-3 text-[0.9375rem] leading-6 text-cream/58 sm:mt-4 sm:text-base sm:leading-7">
            {cameraOptional
              ? "Your microphone is required for the conversation. Your camera is an optional local self view and is never uploaded."
              : "Your microphone is required for the conversation. We’ll check it here before Maya joins."}
          </p>

          <div className="mt-5 min-w-0 overflow-hidden rounded-2xl bg-black/15 sm:mt-7">
            <PermissionRow
              icon={<Mic size={20} aria-hidden="true" />}
              label="Microphone"
              detail={microphoneLabel}
              required
              state={microphoneState}
            />
            <PermissionRow
              icon={cameraState === "skipped" ? <CameraOff size={20} aria-hidden="true" /> : <Camera size={20} aria-hidden="true" />}
              label="Camera"
              detail={cameraLabel}
              state={cameraState}
            />
          </div>

          <div aria-live="polite" className={error ? "mt-3" : "hidden"}>
            {error ? <p className="text-sm leading-6 text-[#ffb4b4]">{error}</p> : null}
          </div>

          <div className="mt-auto pt-4 sm:pt-5">
            {!microphoneReady ? (
              <div className="grid gap-2.5">
                <button
                  type="button"
                  autoFocus
                  onClick={() => void requestAccess(cameraOptional)}
                  disabled={requesting}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cream px-5 text-sm font-semibold text-[#101113] transition hover:bg-white disabled:cursor-wait disabled:opacity-55 outline-none"
                >
                  {requesting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}
                  {requesting
                    ? "Waiting for permission"
                    : cameraOptional
                      ? "Allow microphone & camera"
                      : "Allow microphone"}
                </button>
                {cameraOptional ? (
                  <button
                    type="button"
                    onClick={() => void requestAccess(false)}
                    disabled={requesting}
                    className="min-h-11 text-sm font-medium text-cream/58 transition hover:text-cream disabled:opacity-35"
                  >
                    Continue with microphone only
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="grid gap-2.5">
                <button
                  type="button"
                  onClick={enterInterview}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cream px-5 text-sm font-semibold text-[#101113] transition hover:bg-white"
                >
                  Enter interview
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
                {cameraOptional ? (
                  cameraState === "ready" ? (
                    <button
                      type="button"
                      onClick={skipCamera}
                      className="min-h-11 text-sm font-medium text-cream/58 transition hover:text-cream"
                    >
                      Turn camera off
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void requestCamera()}
                      disabled={cameraState === "requesting"}
                      className="min-h-11 text-sm font-medium text-cream/58 transition hover:text-cream disabled:opacity-35"
                    >
                      {cameraState === "requesting" ? "Starting camera…" : "Add camera"}
                    </button>
                  )
                ) : null}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function PermissionRow({
  icon,
  label,
  detail,
  state,
  required = false
}: {
  icon: React.ReactNode;
  label: string;
  detail: string;
  state: PermissionState;
  required?: boolean;
}) {
  return (
    <div className="flex min-h-[4.25rem] min-w-0 items-center gap-3 px-3 py-2.5 sm:min-h-[4.75rem] sm:px-4 sm:py-3">
      <span className="shrink-0 text-[var(--workspace-accent)]">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-semibold text-cream/88">
          {label}
          {required ? <span className="font-normal text-cream/36">Required</span> : null}
        </span>
        <span className="mt-0.5 block truncate text-sm text-cream/42">{detail}</span>
      </span>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center text-[var(--workspace-accent)]">
        {state === "requesting" ? (
          <Loader2 size={16} className="animate-spin" aria-label="Requesting" />
        ) : state === "ready" ? (
          <Check size={18} aria-label="Ready" />
        ) : state === "error" ? (
          <span className="h-2 w-2 rounded-full bg-[#ff8f8f] shadow-[0_0_10px_#ff8f8f]" aria-label="Needs attention" />
        ) : state === "skipped" ? (
          <span className="h-1.5 w-1.5 rounded-full bg-cream/25" aria-label="Skipped" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-cream/20" aria-label="Permission needed" />
        )}
      </span>
    </div>
  );
}
