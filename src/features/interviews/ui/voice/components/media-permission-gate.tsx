"use client";

import { ArrowRight, Camera, CameraOff, Check, Loader2, Mic, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { MicMeter } from "@/features/interviews/ui/voice/mic-meter";
import { MicrophonePicker } from "./microphone-picker";

const MIC_DEVICE_STORAGE_KEY = "trailgrad.preferredMicrophone";
const MICROPHONE_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true
} as const;

type PermissionState = "idle" | "requesting" | "ready" | "skipped" | "error";

export type MediaSetupResult = {
  cameraStream: MediaStream | null;
  microphoneDeviceId: string;
};

/** Storage can be blocked (private windows); a remembered device is only a hint. */
function readPreferredMicrophone(): string {
  try {
    return window.localStorage.getItem(MIC_DEVICE_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function rememberMicrophone(deviceId: string) {
  try {
    window.localStorage.setItem(MIC_DEVICE_STORAGE_KEY, deviceId);
  } catch {
    // Not remembering the choice is fine; the picker still works.
  }
}

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
  interviewerName,
  onComplete
}: {
  cameraOptional: boolean;
  interviewerName: string;
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
  const [microphoneTrack, setMicrophoneTrack] = useState<MediaStreamTrack | null>(null);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState("");
  const [heardVoice, setHeardVoice] = useState(false);
  const [switchingMicrophone, setSwitchingMicrophone] = useState(false);
  const [cameraLooksDark, setCameraLooksDark] = useState(false);

  const releaseMicrophone = useCallback(() => {
    stopStream(microphoneStreamRef.current);
    microphoneStreamRef.current = null;
    setMicrophoneTrack(null);
  }, []);

  /** Device labels are only available once access is granted. */
  const refreshAudioInputs = useCallback(async () => {
    const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
    setAudioInputs(devices.filter((device) => device.kind === "audioinput"));
  }, []);

  /** Set below; called when the microphone in use disappears. */
  const recoverMicrophoneRef = useRef<() => void>(() => undefined);

  const adoptMicrophoneStream = useCallback((stream: MediaStream) => {
    microphoneStreamRef.current = stream;
    const track = stream.getAudioTracks()[0] ?? null;
    // Unplugging a headset or a Bluetooth drop ends the track without any
    // error; without this the meter just goes flat and nothing recovers.
    track?.addEventListener(
      "ended",
      () => {
        if (microphoneStreamRef.current === stream) recoverMicrophoneRef.current();
      },
      { once: true }
    );
    setMicrophoneTrack(track);
    setMicrophoneLabel(track?.label || "Microphone ready");
    setSelectedMicrophoneId(track?.getSettings().deviceId ?? "");
    setHeardVoice(false);
  }, []);

  const switchMicrophone = useCallback(
    async (deviceId: string) => {
      if (!deviceId || switchingMicrophone) return;
      setSwitchingMicrophone(true);
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { ...MICROPHONE_CONSTRAINTS, deviceId: { exact: deviceId } },
          video: false
        });
        stopStream(microphoneStreamRef.current);
        adoptMicrophoneStream(stream);
        rememberMicrophone(deviceId);
      } catch (caught) {
        setError(permissionError(caught, "microphone"));
      } finally {
        setSwitchingMicrophone(false);
      }
    },
    [switchingMicrophone, adoptMicrophoneStream]
  );

  const handleSignalChange = useCallback((hearing: boolean) => {
    if (hearing) setHeardVoice(true);
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
      const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          // The self-view is a small local panel. A phone gains nothing from
          // capturing a larger frame than it can display, but still pays the
          // camera and compositor cost for every pixel.
          width: { ideal: coarsePointer ? 640 : 960 },
          height: { ideal: coarsePointer ? 360 : 540 },
          frameRate: { ideal: coarsePointer ? 24 : 30, max: 30 }
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
        // Start from the microphone this learner chose last time, if it is still here.
        const preferred = readPreferredMicrophone();
        const microphoneStream = await navigator.mediaDevices
          .getUserMedia({
            audio: preferred
              ? { ...MICROPHONE_CONSTRAINTS, deviceId: { exact: preferred } }
              : MICROPHONE_CONSTRAINTS,
            video: false
          })
          .catch(() =>
            navigator.mediaDevices.getUserMedia({ audio: MICROPHONE_CONSTRAINTS, video: false })
          );
        adoptMicrophoneStream(microphoneStream);
        setMicrophoneState("ready");
        void refreshAudioInputs();
      } catch (caught) {
        setMicrophoneState("error");
        setCameraState(cameraOptional ? "idle" : "skipped");
        setError(permissionError(caught, "microphone"));
        return;
      }

      if (includeCamera && cameraOptional) await requestCamera();
    },
    [
      cameraOptional,
      refreshAudioInputs,
      releaseCamera,
      releaseMicrophone,
      requestCamera,
      adoptMicrophoneStream
    ]
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

  // Fall back to the default microphone when the chosen one goes away. If no
  // microphone is left, return to the permission step instead of a dead meter.
  useEffect(() => {
    recoverMicrophoneRef.current = () => {
      setError(null);
      navigator.mediaDevices
        .getUserMedia({ audio: MICROPHONE_CONSTRAINTS, video: false })
        .then((stream) => {
          stopStream(microphoneStreamRef.current);
          adoptMicrophoneStream(stream);
          void refreshAudioInputs();
        })
        .catch((caught) => {
          releaseMicrophone();
          setMicrophoneState("error");
          setMicrophoneLabel("Microphone disconnected");
          setError(permissionError(caught, "microphone"));
        });
    };
  }, [adoptMicrophoneStream, refreshAudioInputs, releaseMicrophone]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !cameraStream) return;
    video.srcObject = cameraStream;
    void video.play().catch(() => undefined);
  }, [cameraStream]);

  // A closed privacy shutter or a covered lens still delivers a "working"
  // stream, just black frames. Sample a tiny copy of the picture and say so
  // instead of leaving a black panel with no explanation.
  useEffect(() => {
    setCameraLooksDark(false);
    if (!cameraStream) return;
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 18;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    let darkSamples = 0;
    const timer = window.setInterval(() => {
      const video = videoRef.current;
      if (!context || !video || video.readyState < 2) return;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let brightest = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        brightest = Math.max(brightest, pixels[index]!, pixels[index + 1]!, pixels[index + 2]!);
      }
      darkSamples = brightest < 16 ? darkSamples + 1 : 0;
      setCameraLooksDark(darkSamples >= 2);
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [cameraStream]);

  useEffect(
    () => () => {
      stopStream(microphoneStreamRef.current);
      if (!transferredCameraRef.current) stopStream(cameraStreamRef.current);
    },
    []
  );

  useEffect(() => {
    if (microphoneState !== "ready") return;
    navigator.mediaDevices.addEventListener?.("devicechange", refreshAudioInputs);
    return () => navigator.mediaDevices.removeEventListener?.("devicechange", refreshAudioInputs);
  }, [microphoneState, refreshAudioInputs]);

  const requesting = microphoneState === "requesting" || cameraState === "requesting";
  const microphoneReady = microphoneState === "ready";

  return (
    <div className="interview-media-gate relative flex min-h-0 w-full flex-1 items-start justify-center overflow-x-hidden overflow-y-auto overscroll-contain px-0 py-3 [scrollbar-gutter:stable] sm:px-5 sm:py-8 md:items-center">

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-setup-title"
        className="interview-media-dialog interview-mobile-glass relative mx-auto grid w-full min-w-0 max-w-[calc(100vw-2rem)] shrink-0 overflow-hidden rounded-[1.35rem] border border-white/[0.08] bg-[#17181b] sm:max-w-5xl sm:rounded-[1.75rem] lg:grid-cols-[minmax(17rem,0.78fr)_minmax(0,1.22fr)]"
      >
        <div className="interview-media-preview relative aspect-[16/9] min-h-0 overflow-hidden sm:min-h-64 lg:aspect-auto lg:min-h-[32rem]">
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
                <div className="flex items-center gap-3 text-cream/72">
                  <span className="interview-media-icon grid h-12 w-12 place-items-center rounded-2xl border border-white/[0.1]">
                    <Mic size={20} strokeWidth={1.5} aria-hidden="true" />
                  </span>
                  <span className="interview-media-icon grid h-12 w-12 place-items-center rounded-2xl border border-white/[0.1]">
                    {cameraOptional ? (
                      <Camera size={20} strokeWidth={1.5} aria-hidden="true" />
                    ) : (
                      <ShieldCheck size={20} strokeWidth={1.5} aria-hidden="true" />
                    )}
                  </span>
                </div>
              )}
              <p className="mt-5 max-w-[16rem] text-sm leading-6 text-cream/52">
                {requesting
                  ? "Your browser may ask you to confirm access now."
                  : cameraOptional
                    ? `Check your voice and framing before ${interviewerName} joins.`
                    : `Check your voice before ${interviewerName} joins.`}
              </p>
            </div>
          )}
          {/* Only a live picture needs darkening for the chip to stay legible. */}
          {cameraStream ? (
            <div className="interview-media-preview-scrim pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/15" />
          ) : null}
          {cameraStream && cameraLooksDark ? (
            <p
              role="status"
              className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center text-sm leading-6 text-white/80"
            >
              Your camera is sending a black picture. Check its privacy shutter or lighting, or
              turn the camera off. It is optional.
            </p>
          ) : null}
          <div className="interview-media-privacy-chip interview-live-chip absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-sm text-cream/72 backdrop-blur-xl sm:bottom-4 sm:left-4">
            <ShieldCheck size={14} aria-hidden="true" />
            Not recorded
          </div>
        </div>

        <div className="flex min-w-0 flex-col p-5 sm:p-8 lg:p-10">
          <p className="text-[13px] font-medium text-[var(--workspace-accent)]">
            Before {interviewerName} joins
          </p>
          <h1
            id="media-setup-title"
            className="mt-2.5 text-[1.75rem] font-semibold leading-tight tracking-[-0.035em] text-cream sm:mt-3 sm:text-4xl"
          >
            Set up your interview.
          </h1>
          <p className="mt-3 text-[0.9375rem] leading-6 text-cream/58 sm:mt-4 sm:text-base sm:leading-7">
            {cameraOptional
              ? "Your microphone is required for the conversation. Your camera is an optional local self view and is never uploaded."
              : `Your microphone is required for the conversation. We’ll check it here before ${interviewerName} joins.`}
          </p>

          <div className="interview-media-permissions interview-media-rows mt-5 min-w-0 sm:mt-7">
            <PermissionRow
              icon={<Mic size={18} strokeWidth={1.5} aria-hidden="true" />}
              label="Microphone"
              detail={microphoneLabel}
              required
              state={microphoneState}
            />
            <PermissionRow
              icon={
                cameraState === "skipped" ? (
                  <CameraOff size={18} strokeWidth={1.5} aria-hidden="true" />
                ) : (
                  <Camera size={18} strokeWidth={1.5} aria-hidden="true" />
                )
              }
              label="Camera"
              detail={cameraLabel}
              state={cameraState}
            />
          </div>

          {microphoneReady ? (
            <div className="interview-mic-check interview-media-rule mt-1 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-cream">Check your microphone</p>
                {/* The meter below already says "Say something"; this only confirms. */}
                <span className="text-sm text-[var(--workspace-accent)]" aria-live="polite">
                  {heardVoice ? `${interviewerName} will hear you` : null}
                </span>
              </div>
              <p className="mt-1 text-sm leading-6 text-cream/52">
                Speak normally. If the bars don&apos;t move, choose the microphone you are talking
                into.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <MicrophonePicker
                  devices={audioInputs}
                  selectedId={selectedMicrophoneId}
                  disabled={switchingMicrophone}
                  onChange={(deviceId) => void switchMicrophone(deviceId)}
                />
                <MicMeter
                  track={microphoneTrack}
                  muted={false}
                  onSignalChange={handleSignalChange}
                />
              </div>
            </div>
          ) : null}

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
                  {requesting ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Mic size={16} aria-hidden="true" />
                  )}
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
    <div className="interview-media-row flex min-h-[4.25rem] min-w-0 items-center gap-3.5 py-3 sm:min-h-[4.5rem]">
      <span className="interview-media-icon grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/[0.1] text-cream/72">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-semibold text-cream">
          {label}
          {required ? <span className="text-xs font-normal text-cream/42">Required</span> : null}
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-cream/48">{detail}</span>
      </span>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center text-[var(--workspace-accent)]">
        {state === "requesting" ? (
          <Loader2 size={16} className="animate-spin" aria-label="Requesting" />
        ) : state === "ready" ? (
          <Check size={18} aria-label="Ready" />
        ) : state === "error" ? (
          <span className="h-2 w-2 rounded-full bg-[#ef4444]" aria-label="Needs attention" />
        ) : state === "skipped" ? (
          <span className="h-1.5 w-1.5 rounded-full bg-cream/25" aria-label="Skipped" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-cream/20" aria-label="Permission needed" />
        )}
      </span>
    </div>
  );
}
