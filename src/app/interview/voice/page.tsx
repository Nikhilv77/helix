"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import type {
  AudioCaptureOptions,
  Participant,
  RemoteParticipant,
  RemoteTrack,
  TranscriptionSegment
} from "livekit-client";
import { Loader2, Mic, MicOff, RefreshCw, Square, Volume2 } from "lucide-react";
import { HelixMark } from "@/components/helix-mark";
import { PathRail } from "@/components/interview/path-rail";
import { MicMeter } from "@/components/interview/mic-meter";
import { InterviewerPresence } from "@/components/interview/interviewer-presence";
import { AvatarStage } from "@/components/interview/avatar-stage";
import type { PresenceState } from "@/components/interview/interviewer-presence";
import { ApiClientError, endInterview, getSession } from "@/lib/api-client";
import type { Phase, Turn } from "@/lib/types";

const HARD_CAP_MS = 15 * 60 * 1000;
const AVATAR_URL = process.env.NEXT_PUBLIC_AVATAR_URL ?? "";
const POLL_MS = 1500;
const AGENT_STATE_ATTRIBUTE = "lk.agent.state";
const AGENT_JOIN_TIMEOUT_MS = 15_000;
const MIC_SILENCE_WARNING_MS = 6_000;
const MIC_DEVICE_STORAGE_KEY = "helix.preferredMicrophone";

type Status = "connecting" | "waiting" | "live" | "reconnecting" | "ended" | "error";
type AgentState = "initializing" | "idle" | "listening" | "thinking" | "speaking";

export default function VoiceInterviewPage() {
  return (
    <Suspense fallback={<Shell>{null}</Shell>}>
      <VoiceInterview />
    </Suspense>
  );
}

function VoiceInterview() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params?.get("session") ?? null;

  const [status, setStatus] = useState<Status>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [sessionUnavailable, setSessionUnavailable] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [phase, setPhase] = useState<Phase>("questioning");
  const [progress, setProgress] = useState({ index: 0, count: 4, followUps: 0 });
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [agentTrack, setAgentTrack] = useState<MediaStreamTrack | null>(null);
  const [localTrack, setLocalTrack] = useState<MediaStreamTrack | null>(null);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedInputId, setSelectedInputId] = useState("");
  const [switchingMic, setSwitchingMic] = useState(false);
  const [micSignal, setMicSignal] = useState(false);
  const [micSilent, setMicSilent] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const agentIdentityRef = useRef<string | null>(null);
  const agentReadyRef = useRef(false);
  const agentWaitTimerRef = useRef<number | null>(null);
  const stopPollingRef = useRef(false);
  const sessionCompleteRef = useRef(false);
  const intentionalDisconnectRef = useRef(false);
  const micRetryRef = useRef<(() => void) | null>(null);
  const audioRetryRef = useRef<(() => void) | null>(null);
  const teardownRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [connectionAttempt, setConnectionAttempt] = useState(0);

  // Join the room. The token carries the agent dispatch, so connecting is what
  // summons the interviewer.
  useEffect(() => {
    if (!sessionId) {
      router.replace("/interview");
      return;
    }

    // React Strict Mode mounts, unmounts, then remounts effects in dev. A
    // naive disconnect in cleanup tears down the WebRTC session mid-negotiation,
    // which surfaces as "DataChannel User-Initiated Abort". Teardown is deferred
    // so a synthetic remount can cancel it.
    if (teardownRef.current !== null) {
      window.clearTimeout(teardownRef.current);
      teardownRef.current = null;
    }
    if (roomRef.current) {
      const existing = roomRef.current;
      if (existing.state === "connected") {
        setStatus(agentReadyRef.current ? "live" : "waiting");
        const mic = existing.localParticipant.getTrackPublication(Track.Source.Microphone);
        if (mic?.track) {
          setLocalTrack(mic.track.mediaStreamTrack);
          setMicOn(!mic.isMuted);
        }
      }
      return;
    }

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: microphoneOptions()
    });
    roomRef.current = room;
    intentionalDisconnectRef.current = false;
    agentReadyRef.current = false;
    agentIdentityRef.current = null;
    setAgentState(null);
    setAgentSpeaking(false);
    setError(null);

    function clearAgentWaitTimer() {
      if (agentWaitTimerRef.current !== null) {
        window.clearTimeout(agentWaitTimerRef.current);
        agentWaitTimerRef.current = null;
      }
    }

    function markAgentReady(participant: RemoteParticipant) {
      agentIdentityRef.current = participant.identity;
      agentReadyRef.current = true;
      clearAgentWaitTimer();
      setError(null);
      setStatus((current) => (current === "ended" ? current : "live"));
    }

    async function updateAudioInputs(target: Room, track?: MediaStreamTrack) {
      const devices = await Room.getLocalDevices("audioinput", false).catch(() => []);
      setAudioInputs(devices);

      const activeId = track?.getSettings().deviceId ?? target.getActiveDevice("audioinput") ?? "";
      setSelectedInputId(activeId || devices[0]?.deviceId || "");
    }

    function updateAgentState(participant: RemoteParticipant) {
      const next = participant.attributes[AGENT_STATE_ATTRIBUTE];
      if (!next) return;

      markAgentReady(participant);
      if (next === "failed" || next === "disconnected") {
        setError("The interviewer disconnected. Your session is safe — reconnect to continue.");
        setStatus("error");
        return;
      }

      if (isAgentState(next)) {
        setAgentState(next);
        setAgentSpeaking(next === "speaking");
      }
    }

    room.on(RoomEvent.ParticipantConnected, updateAgentState);

    room.on(RoomEvent.ParticipantAttributesChanged, (_changed, participant) => {
      if (participant.identity === room.localParticipant.identity) return;
      updateAgentState(participant as RemoteParticipant);
    });

    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _publication, participant) => {
      if (track.kind === Track.Kind.Audio && audioRef.current) {
        markAgentReady(participant);
        track.attach(audioRef.current);
        void audioRef.current.play().catch(() => setPlaybackBlocked(true));
        // The same track feeds the analyser that sculpts the figure.
        setAgentTrack(track.mediaStreamTrack);
      }
    });

    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      if (track.kind !== Track.Kind.Audio) return;
      track.detach();
      setAgentTrack(null);
    });

    room.on(RoomEvent.LocalTrackPublished, (publication) => {
      if (publication.kind === Track.Kind.Audio && publication.track) {
        const track = publication.track.mediaStreamTrack;
        setLocalTrack(track);
        void updateAudioInputs(room, track);
      }
    });

    room.on(RoomEvent.MediaDevicesChanged, () => {
      void updateAudioInputs(room);
    });

    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      setAgentSpeaking(speakers.some((speaker) => speaker.identity === agentIdentityRef.current));
    });

    room.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
      updateLiveTranscript(
        segments,
        participant,
        room,
        agentIdentityRef.current,
        setLiveTranscript
      );
    });

    room.on(RoomEvent.AudioPlaybackStatusChanged, (playing) => {
      setPlaybackBlocked(!playing);
    });

    room.on(RoomEvent.MediaDevicesError, (mediaError) => {
      setMicOn(false);
      setMicError(mediaError.message || "The microphone became unavailable.");
    });

    room.on(RoomEvent.Reconnecting, () => {
      setStatus((current) => (current === "ended" ? current : "reconnecting"));
    });

    room.on(RoomEvent.Reconnected, () => {
      setStatus((current) =>
        current === "ended" ? current : agentReadyRef.current ? "live" : "waiting"
      );
    });

    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      if (participant.identity !== agentIdentityRef.current) return;
      agentReadyRef.current = false;
      setAgentState(null);
      setAgentSpeaking(false);
      setAgentTrack(null);
      if (sessionCompleteRef.current) return;
      setError("The interviewer disconnected. Your session is safe — reconnect to continue.");
      setStatus((current) => (current === "ended" ? current : "error"));
    });

    room.on(RoomEvent.Disconnected, () => {
      if (intentionalDisconnectRef.current || sessionCompleteRef.current) return;
      setError("The call disconnected. Your answers are saved, so you can reconnect safely.");
      setStatus((current) => (current === "ended" ? current : "error"));
    });

    async function connect() {
      try {
        const response = await fetch("/api/livekit/token", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId })
        });
        const payload = await response.json();
        if (!payload?.success) {
          throw new Error(payload?.error?.message ?? "Could not join the room");
        }

        await room.connect(payload.data.url, payload.data.token);
        setStatus(agentReadyRef.current ? "live" : "waiting");

        await Promise.all([enableAudio(room), enableMic(room)]);

        room.remoteParticipants.forEach(updateAgentState);
        if (!agentReadyRef.current) {
          agentWaitTimerRef.current = window.setTimeout(() => {
            if (agentReadyRef.current) return;
            setError(
              "The voice interviewer did not join. Reconnect once the voice worker is online."
            );
            setStatus("error");
          }, AGENT_JOIN_TIMEOUT_MS);
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not connect");
        setStatus("error");
      }
    }

    async function enableAudio(target: Room) {
      try {
        await target.startAudio();
        await audioRef.current?.play();
        setPlaybackBlocked(false);
      } catch {
        setPlaybackBlocked(true);
      }
    }

    async function enableMic(target: Room) {
      try {
        const rememberedDevice = window.localStorage.getItem(MIC_DEVICE_STORAGE_KEY) ?? "";
        try {
          await target.localParticipant.setMicrophoneEnabled(
            true,
            microphoneOptions(rememberedDevice)
          );
        } catch (caught) {
          if (!rememberedDevice) throw caught;
          window.localStorage.removeItem(MIC_DEVICE_STORAGE_KEY);
          await target.localParticipant.setMicrophoneEnabled(true, microphoneOptions());
        }

        const mic = target.localParticipant.getTrackPublication(Track.Source.Microphone);
        if (mic?.track) {
          const track = mic.track.mediaStreamTrack;
          setLocalTrack(track);
          setMicError(null);
          setMicOn(!mic.isMuted && track.enabled && track.readyState === "live");
          setMicSilent(false);
          await updateAudioInputs(target, track);
        } else {
          setMicError("The microphone did not publish. Try the retry button below.");
        }
      } catch (caught) {
        const name = caught instanceof Error ? caught.name : "";
        setMicOn(false);
        setMicError(
          name === "NotAllowedError"
            ? "Microphone blocked. Click the icon at the left of the address bar, set Microphone to Allow, then press retry."
            : name === "NotFoundError"
              ? "No microphone found. Check your input device and press retry."
              : "The microphone could not start. Press retry."
        );
      }
    }

    micRetryRef.current = () => void enableMic(room);
    audioRetryRef.current = () => void enableAudio(room);

    void connect();

    return () => {
      clearAgentWaitTimer();
      teardownRef.current = window.setTimeout(() => {
        intentionalDisconnectRef.current = true;
        void room.disconnect();
        roomRef.current = null;
        teardownRef.current = null;
      }, 400);
    };
  }, [connectionAttempt, router, sessionId]);

  // The transcript comes from the brain, not from LiveKit — the server already
  // records every turn with millisecond timings.
  const poll = useCallback(async () => {
    if (!sessionId || stopPollingRef.current) return;
    try {
      const session = await getSession(sessionId);
      setTurns(session.turns);
      setPhase(session.phase);
      setStartedAt(session.startedAt);
      setProgress({
        index: session.questionIndex,
        count: session.questionCount,
        followUps: session.followUpCount
      });
      if (session.phase === "done") {
        sessionCompleteRef.current = true;
        setError(null);
        setStatus("ended");
      }
    } catch (caught) {
      if (caught instanceof ApiClientError && caught.code === "SESSION_NOT_FOUND") {
        stopPollingRef.current = true;
        setSessionUnavailable(true);
        setError("This interview session has expired. Start a new interview to continue.");
        setStatus("error");
      }
      // Other failures are transient; the next tick retries.
    }
  }, [sessionId]);

  useEffect(() => {
    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [poll]);

  useEffect(() => {
    if (startedAt === null || status === "ended") return;
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt), 500);
    return () => window.clearInterval(timer);
  }, [startedAt, status]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  useEffect(() => {
    if (agentState === "speaking") setLiveTranscript("");
  }, [agentState]);

  useEffect(() => {
    if (status !== "live" || !micOn || agentSpeaking || micSignal || liveTranscript) {
      setMicSilent(false);
      return;
    }

    const timer = window.setTimeout(() => setMicSilent(true), MIC_SILENCE_WARNING_MS);
    return () => window.clearTimeout(timer);
  }, [agentSpeaking, liveTranscript, micOn, micSignal, status]);

  const handleMicSignalChange = useCallback((hearing: boolean) => {
    setMicSignal(hearing);
    if (hearing) setMicSilent(false);
  }, []);

  async function switchMicrophone(deviceId: string) {
    const room = roomRef.current;
    if (!room || !deviceId || switchingMic) return;

    setSwitchingMic(true);
    setMicError(null);
    setMicSilent(false);
    setMicSignal(false);

    try {
      await room.switchActiveDevice("audioinput", deviceId, true);
      const publication = room.localParticipant.getTrackPublication(Track.Source.Microphone);
      const track = publication?.track?.mediaStreamTrack;
      if (!track) throw new Error("The selected microphone did not start.");

      setLocalTrack(track);
      setSelectedInputId(deviceId);
      setMicOn(!publication.isMuted && track.enabled && track.readyState === "live");
      window.localStorage.setItem(MIC_DEVICE_STORAGE_KEY, deviceId);
    } catch (caught) {
      setMicError(
        caught instanceof Error ? caught.message : "Could not switch to that microphone."
      );
    } finally {
      setSwitchingMic(false);
    }
  }

  async function toggleMic() {
    const room = roomRef.current;
    if (!room) return;

    if (!micOn) {
      micRetryRef.current?.();
      return;
    }

    await room.localParticipant.setMicrophoneEnabled(false);
    setMicOn(false);
  }

  async function stop() {
    if (!sessionId) return;
    sessionCompleteRef.current = true;
    setError(null);
    setStatus("ended");
    await endInterview(sessionId).catch(() => null);
    intentionalDisconnectRef.current = true;
    await roomRef.current?.disconnect();
  }

  async function reconnect() {
    if (agentWaitTimerRef.current !== null) {
      window.clearTimeout(agentWaitTimerRef.current);
      agentWaitTimerRef.current = null;
    }

    setError(null);
    setPlaybackBlocked(false);
    setStatus("connecting");
    agentReadyRef.current = false;
    agentIdentityRef.current = null;
    setAgentState(null);
    setAgentSpeaking(false);
    setAgentTrack(null);
    setLocalTrack(null);
    setLiveTranscript("");

    const existing = roomRef.current;
    roomRef.current = null;
    intentionalDisconnectRef.current = true;
    await existing?.disconnect().catch(() => null);
    intentionalDisconnectRef.current = false;
    setConnectionAttempt((attempt) => attempt + 1);
  }

  const overCap = elapsed >= HARD_CAP_MS;
  // Only the live exchange belongs on screen; the full record is the report's job.
  const recent = turns.slice(-3);

  const presence: PresenceState =
    status === "ended"
      ? "ended"
      : status !== "live"
        ? "connecting"
        : agentSpeaking
          ? "speaking"
          : "listening";
  const micAvailable = status === "waiting" || status === "live" || status === "reconnecting";
  const statusLabel = describeVoiceState(
    status,
    agentState,
    micOn,
    agentSpeaking,
    micSignal,
    micSilent
  );
  const selectedInputLabel =
    audioInputs.find((device) => device.deviceId === selectedInputId)?.label ||
    "Selected microphone";

  return (
    <Shell>
      <audio ref={audioRef} autoPlay />

      <header className="relative flex flex-wrap items-center gap-4 pb-5">
        <Link href="/" className="flex items-center gap-2.5 text-cream">
          <HelixMark className="h-7 w-7" />
          <span className="text-base font-semibold tracking-tight">Helix</span>
        </Link>

        <span className="blueprint-label hidden items-center gap-2 rounded-full border border-cream/20 px-3 py-1 text-cream/60 sm:flex">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              status === "live"
                ? "bg-[#4bab7c]"
                : status === "error"
                  ? "bg-[#dd5f5f]"
                  : "bg-[#e0a13c]"
            }`}
          />
          Voice
        </span>

        <div className="hidden lg:block">
          <PathRail
            phase={phase}
            questionIndex={progress.index}
            questionCount={progress.count}
            followUpCount={progress.followUps}
          />
        </div>

        <div className="ml-auto flex items-center gap-4">
          <span
            className={`font-mono text-xs tabular-nums ${overCap ? "text-[#ff9a9a]" : "text-cream/60"}`}
          >
            {formatClock(elapsed)}
            <span className="text-cream/25"> / 15:00</span>
          </span>
          <button
            type="button"
            onClick={() => void stop()}
            disabled={status === "ended"}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-cream/20 px-3 text-xs font-semibold text-cream/60 transition hover:border-[#dd5f5f]/60 hover:text-cream disabled:opacity-30"
          >
            <Square size={11} aria-hidden="true" />
            End
          </button>
        </div>

        <div className="absolute inset-x-0 bottom-0 h-px bg-cream/12">
          <div
            className={`h-full transition-all duration-500 ${overCap ? "bg-[#dd5f5f]" : "bg-cream/70"}`}
            style={{ width: `${Math.min(100, (elapsed / HARD_CAP_MS) * 100)}%` }}
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none flex min-h-[30vh] flex-1 items-center justify-center sm:min-h-[34vh]">
          <div className="h-full max-h-[31rem] w-full max-w-[31rem]">
            {AVATAR_URL ? (
              <AvatarStage agentTrack={agentTrack} state={presence} url={AVATAR_URL} />
            ) : (
              <InterviewerPresence
                agentTrack={agentTrack}
                localTrack={localTrack}
                state={presence}
              />
            )}
          </div>
        </div>

        <div className="thin-scroll fade-top max-h-[36vh] w-full shrink-0 space-y-4 overflow-y-auto pb-1 pr-1">
          {status === "connecting" || status === "waiting" || status === "reconnecting" ? (
            <p className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-cream/40">
              <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              {status === "waiting"
                ? "Bringing the interviewer in"
                : status === "reconnecting"
                  ? "Restoring the call"
                  : "Connecting to the room"}
            </p>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-[#dd5f5f]/45 bg-[#dd5f5f]/10 px-4 py-3">
              <p className="text-sm text-cream">{error}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {!sessionUnavailable ? (
                  <button
                    type="button"
                    onClick={() => void reconnect()}
                    className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-cream/40 px-3 text-xs font-semibold text-cream transition hover:bg-cream/10"
                  >
                    <RefreshCw size={13} aria-hidden="true" />
                    Reconnect
                  </button>
                ) : null}
                <Link href="/interview" className="text-xs text-cream/60 underline">
                  Start over
                </Link>
              </div>
            </div>
          ) : null}

          {playbackBlocked ? (
            <div className="rounded-xl border border-cream/25 bg-cream/[0.06] px-4 py-3">
              <p className="text-sm leading-6 text-cream">
                Your browser paused call audio. Enable it once and the conversation will continue.
              </p>
              <button
                type="button"
                onClick={() => audioRetryRef.current?.()}
                className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-lg border border-cream/40 px-3 text-xs font-semibold text-cream transition hover:bg-cream/10"
              >
                <Volume2 size={14} aria-hidden="true" />
                Enable audio
              </button>
            </div>
          ) : null}

          {micError ? (
            <div className="rounded-xl border border-[#e0a13c]/50 bg-[#e0a13c]/10 px-4 py-3">
              <p className="text-sm leading-6 text-cream">{micError}</p>
              <button
                type="button"
                onClick={() => micRetryRef.current?.()}
                className="mt-2 inline-flex min-h-9 items-center rounded-lg border border-cream/40 px-3 text-xs font-semibold text-cream transition hover:bg-cream/10"
              >
                Retry microphone
              </button>
            </div>
          ) : null}

          {micSilent && !micError ? (
            <div className="rounded-xl border border-[#e0a13c]/55 bg-[#e0a13c]/10 px-4 py-3">
              <p className="text-sm font-medium text-cream">No microphone signal detected</p>
              <p className="mt-1 text-xs leading-5 text-cream/60">
                Helix connected to {selectedInputLabel}, but no audible sound is arriving. Choose
                the microphone you are speaking into.
              </p>
              <MicrophonePicker
                devices={audioInputs}
                selectedId={selectedInputId}
                disabled={switchingMic}
                onChange={(deviceId) => void switchMicrophone(deviceId)}
                className="mt-3 max-w-sm"
              />
            </div>
          ) : null}

          {recent.map((turn, index) => (
            <TurnLine
              key={`${turn.startMs}-${index}`}
              turn={turn}
              latest={index === recent.length - 1 && turn.speaker === "agent"}
            />
          ))}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 border-t border-cream/15 py-4 sm:gap-4 sm:py-6">
        <button
          type="button"
          onClick={() => void toggleMic()}
          disabled={!micAvailable}
          className={`flex h-12 w-12 items-center justify-center rounded-full border transition disabled:opacity-30 ${
            micOn ? "border-cream bg-cream text-blueprint" : "border-cream/30 text-cream/60"
          }`}
          aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
        >
          {micOn ? <Mic size={18} aria-hidden="true" /> : <MicOff size={18} aria-hidden="true" />}
        </button>

        <div className="flex-1">
          <p className="text-sm font-medium text-cream">{statusLabel}</p>
          {liveTranscript ? (
            <p className="mt-1 max-w-xl truncate text-xs text-cream/45">{liveTranscript}</p>
          ) : null}
          <div className="mt-1.5">
            <MicMeter
              track={localTrack}
              muted={!micOn || !micAvailable}
              onSignalChange={handleMicSignalChange}
            />
          </div>
        </div>

        <div className="hidden min-w-0 max-w-[13rem] shrink-0 sm:block">
          <MicrophonePicker
            devices={audioInputs}
            selectedId={selectedInputId}
            disabled={!micAvailable || switchingMic}
            onChange={(deviceId) => void switchMicrophone(deviceId)}
          />
          <Link
            href={`/interview/text?session=${sessionId ?? ""}`}
            className="mt-2 block text-right font-mono text-[9px] uppercase tracking-[0.16em] text-cream/30 transition hover:text-cream/70"
          >
            Use text instead
          </Link>
        </div>
      </div>
    </Shell>
  );
}

function MicrophonePicker({
  devices,
  selectedId,
  disabled,
  onChange,
  className = ""
}: {
  devices: MediaDeviceInfo[];
  selectedId: string;
  disabled: boolean;
  onChange: (deviceId: string) => void;
  className?: string;
}) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="sr-only">Microphone input</span>
      <select
        value={selectedId}
        disabled={disabled || devices.length === 0}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full truncate rounded-lg border border-cream/20 bg-blueprint px-3 text-xs text-cream outline-none transition focus:border-cream/60 disabled:opacity-40"
        aria-label="Microphone input"
      >
        {devices.length === 0 ? <option value="">No microphone found</option> : null}
        {devices.map((device, index) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || `Microphone ${index + 1}`}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * One line of the spoken exchange. Only the newest agent line is emphasised —
 * this is a conversation you are listening to, not a chat log to read back.
 */
function TurnLine({ turn, latest }: { turn: Turn; latest: boolean }) {
  const label = turn.speaker === "user" ? "You" : "Helix";

  return (
    <div className="msg-in">
      <p
        className={`font-mono text-[10px] uppercase tracking-[0.2em] ${
          turn.speaker === "user" ? "text-cream/30" : "text-cream/45"
        }`}
      >
        {label}
      </p>
      <p
        className={
          turn.speaker === "user"
            ? "mt-1.5 text-[15px] leading-8 text-cream/50"
            : latest
              ? "mt-1.5 text-xl font-medium leading-9 text-cream"
              : "mt-1.5 text-[15px] leading-8 text-cream/60"
        }
      >
        {turn.text}
      </p>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="blueprint relative h-[100svh] overflow-hidden px-4 sm:px-8">
      <div className="blueprint-glow" />
      <div className="relative z-10 mx-auto flex h-full w-full max-w-4xl flex-col pt-6">
        {children}
      </div>
    </main>
  );
}

function microphoneOptions(deviceId = ""): AudioCaptureOptions {
  return {
    autoGainControl: true,
    echoCancellation: true,
    noiseSuppression: true,
    channelCount: 1,
    ...(deviceId ? { deviceId: { exact: deviceId } } : {})
  };
}

function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function isAgentState(value: string): value is AgentState {
  return (
    value === "initializing" ||
    value === "idle" ||
    value === "listening" ||
    value === "thinking" ||
    value === "speaking"
  );
}

function updateLiveTranscript(
  segments: TranscriptionSegment[],
  participant: Participant | undefined,
  room: Room,
  agentIdentity: string | null,
  update: (text: string) => void
) {
  if (!participant || participant.identity === agentIdentity) return;
  if (participant.identity !== room.localParticipant.identity) return;

  const text = segments
    .map((segment) => segment.text.trim())
    .filter(Boolean)
    .join(" ")
    .trim();

  if (text) update(text);
}

function describeVoiceState(
  status: Status,
  agentState: AgentState | null,
  micOn: boolean,
  activeSpeakerFallback: boolean,
  micSignal: boolean,
  micSilent: boolean
): string {
  if (status === "ended") return "Interview complete";
  if (status === "error") return "Connection needs attention";
  if (status === "reconnecting") return "Restoring the call";
  if (status === "connecting") return "Connecting securely";
  if (status === "waiting") return "Interviewer is joining";
  if (agentState === "initializing") return "Interviewer is getting ready";
  if (agentState === "thinking") return "Helix is thinking";
  if (agentState === "speaking" || activeSpeakerFallback) return "Helix is speaking";
  if (!micOn) return "Microphone muted";
  if (micSignal) return "Hearing you";
  if (micSilent) return "No microphone signal";
  return "Listening. Speak now";
}
