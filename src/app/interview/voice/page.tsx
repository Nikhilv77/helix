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
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Code2,
  Keyboard,
  Loader2,
  Mic,
  MicOff,
  RefreshCw,
  Send,
  ShieldCheck,
  Square,
  Volume2,
  WifiOff,
  X
} from "lucide-react";
import { HelixMark } from "@/components/helix-mark";
import { PathRail } from "@/components/interview/path-rail";
import { MicMeter } from "@/components/interview/mic-meter";
import { InterviewerPresence } from "@/components/interview/interviewer-presence";
import { AvatarStage } from "@/components/interview/avatar-stage";
import type { PresenceState } from "@/components/interview/interviewer-presence";
import { ApiClientError, endInterview, getSession } from "@/lib/api-client";
import { pageTitle } from "@/lib/seo";
import type { InterviewQuestion, InterviewSetup, Phase, Turn } from "@/lib/types";

const HARD_CAP_MS = 15 * 60 * 1000;
const AVATAR_URL = process.env.NEXT_PUBLIC_AVATAR_URL ?? "";
const POLL_MS = 1500;
const AGENT_STATE_ATTRIBUTE = "lk.agent.state";
const AGENT_JOIN_TIMEOUT_MS = 15_000;
const MIC_SILENCE_WARNING_MS = 6_000;
const MIC_DEVICE_STORAGE_KEY = "helix.preferredMicrophone";
const TYPED_ANSWER_TOPIC = "helix.typed-answer";

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
  const [sessionChecked, setSessionChecked] = useState(false);
  const [sessionLoadError, setSessionLoadError] = useState<string | null>(null);
  const [sessionUnavailable, setSessionUnavailable] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [phase, setPhase] = useState<Phase>("questioning");
  const [setup, setSetup] = useState<InterviewSetup | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<InterviewQuestion | null>(null);
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
  const [answerPanelOpen, setAnswerPanelOpen] = useState(false);
  const [typedDraft, setTypedDraft] = useState("");
  const [typedNotes, setTypedNotes] = useState("");
  const [typedStartedAt, setTypedStartedAt] = useState<number | null>(null);
  const [typedSending, setTypedSending] = useState(false);
  const [typedError, setTypedError] = useState<string | null>(null);

  const roomRef = useRef<Room | null>(null);
  const agentIdentityRef = useRef<string | null>(null);
  const agentReadyRef = useRef(false);
  const agentWaitTimerRef = useRef<number | null>(null);
  const stopPollingRef = useRef(false);
  const sessionCompleteRef = useRef(false);
  const sessionCheckedRef = useRef(false);
  const intentionalDisconnectRef = useRef(false);
  const micRetryRef = useRef<(() => void) | null>(null);
  const audioRetryRef = useRef<(() => void) | null>(null);
  const teardownRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typedUserTurnsRef = useRef(0);
  const [connectionAttempt, setConnectionAttempt] = useState(0);

  useEffect(() => {
    const title =
      status === "live"
        ? phase === "wrap"
          ? "Interview Wrap-up"
          : "Live Interview"
        : status === "ended"
          ? "Interview Complete"
          : status === "error"
            ? "Interview Error"
            : "Connecting Interview";
    document.title = pageTitle(title);
  }, [phase, status]);

  // Join the room. The token carries the agent dispatch, so connecting is what
  // summons the interviewer.
  useEffect(() => {
    if (!sessionId) {
      router.replace("/interview");
      return;
    }

    // Do not open a media room until the durable interview state has been
    // verified. This prevents an expired session from flashing a live call
    // underneath its recovery message.
    if (!sessionChecked || sessionUnavailable || sessionCompleteRef.current) return;

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
  }, [connectionAttempt, router, sessionChecked, sessionId, sessionUnavailable]);

  // The transcript comes from the brain, not from LiveKit — the server already
  // records every turn with millisecond timings.
  const poll = useCallback(async () => {
    if (!sessionId || stopPollingRef.current) return;
    try {
      const session = await getSession(sessionId);
      setTurns(session.turns);
      setPhase(session.phase);
      setSetup(session.setup);
      setCurrentQuestion(session.currentQuestion);
      setStartedAt(session.startedAt);
      setSessionLoadError(null);
      sessionCheckedRef.current = true;
      setSessionChecked(true);
      setProgress({
        index: session.questionIndex,
        count: session.questionCount,
        followUps: session.followUpCount
      });
      if (session.phase === "done") {
        sessionCompleteRef.current = true;
        stopPollingRef.current = true;
        setError(null);
        setStatus("ended");
      }
    } catch (caught) {
      if (caught instanceof ApiClientError && caught.code === "SESSION_NOT_FOUND") {
        stopPollingRef.current = true;
        sessionCheckedRef.current = false;
        setSessionChecked(false);
        setSessionUnavailable(true);
        setStartedAt(null);
        setElapsed(0);
        setTurns([]);
        setCurrentQuestion(null);
        setAnswerPanelOpen(false);
        intentionalDisconnectRef.current = true;
        void roomRef.current?.disconnect().catch(() => null);
        roomRef.current = null;
        setError(null);
        setStatus("error");
      } else if (!sessionCheckedRef.current) {
        setSessionLoadError(
          "We couldn't load this interview. Check your connection and try again."
        );
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
    if (!typedSending) return;

    const userTurns = turns.filter((turn) => turn.speaker === "user").length;
    if (userTurns <= typedUserTurnsRef.current) return;

    setTypedSending(false);
    setAnswerPanelOpen(false);
    setTypedDraft("");
    setTypedNotes("");
    setTypedStartedAt(null);
  }, [turns, typedSending]);

  useEffect(() => {
    if (startedAt === null || sessionUnavailable || status === "ended" || status === "error")
      return;

    const updateElapsed = () => setElapsed(Math.min(HARD_CAP_MS, Date.now() - startedAt));
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 500);
    return () => window.clearInterval(timer);
  }, [sessionUnavailable, startedAt, status]);

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

  async function openTypedAnswer() {
    const room = roomRef.current;
    if (!room || status !== "live" || typedSending) return;

    if (micOn) {
      await room.localParticipant.setMicrophoneEnabled(false).catch(() => null);
      setMicOn(false);
    }

    if (!typedDraft && currentQuestion?.kind === "code") {
      setTypedDraft(currentQuestion.codeSnippet ?? "");
    }
    setTypedError(null);
    setTypedStartedAt(Date.now());
    setAnswerPanelOpen(true);
  }

  async function submitTypedAnswer() {
    const room = roomRef.current;
    const answer = formatTypedAnswer(currentQuestion, typedDraft, typedNotes);
    if (!room || !sessionId || !startedAt || !answer || typedSending) return;

    const now = Date.now();
    const startMs = Math.max(0, (typedStartedAt ?? now) - startedAt);
    const endMs = Math.max(startMs, now - startedAt);
    typedUserTurnsRef.current = turns.filter((turn) => turn.speaker === "user").length;
    setTypedSending(true);
    setTypedError(null);

    try {
      await room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ text: answer, startMs, endMs })),
        { reliable: true, topic: TYPED_ANSWER_TOPIC }
      );
    } catch (caught) {
      setTypedSending(false);
      setTypedError(
        caught instanceof Error ? caught.message : "The typed answer could not be sent."
      );
    }
  }

  const stop = useCallback(async () => {
    if (!sessionId) return;
    sessionCompleteRef.current = true;
    setError(null);
    setStatus("ended");
    await endInterview(sessionId).catch(() => null);
    intentionalDisconnectRef.current = true;
    await roomRef.current?.disconnect();
  }, [sessionId]);

  useEffect(() => {
    if (elapsed < HARD_CAP_MS || status === "ended" || sessionUnavailable) return;
    void stop();
  }, [elapsed, sessionUnavailable, status, stop]);

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
  // The call surface keeps one conversational moment in focus. The complete
  // transcript belongs in the post-interview report.
  const latestAgentTurn = [...turns].reverse().find((turn) => turn.speaker === "agent") ?? null;
  const latestUserTurn = [...turns].reverse().find((turn) => turn.speaker === "user") ?? null;

  const presence: PresenceState =
    status === "ended"
      ? "ended"
      : status !== "live"
        ? "connecting"
        : agentState === "thinking"
          ? "thinking"
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

  if (sessionUnavailable) {
    return <SessionStateScreen kind="expired" />;
  }

  if (!sessionChecked) {
    return (
      <SessionLoadingScreen
        error={sessionLoadError}
        onRetry={() => {
          setSessionLoadError(null);
          void poll();
        }}
      />
    );
  }

  if (status === "ended") {
    return (
      <SessionStateScreen
        kind="complete"
        duration={Math.min(elapsed, HARD_CAP_MS)}
        answers={turns.filter((turn) => turn.speaker === "user").length}
      />
    );
  }

  return (
    <Shell>
      <audio ref={audioRef} autoPlay />

      <header className="relative flex flex-wrap items-center gap-4 pb-5">
        <Link href="/" className="flex items-center gap-2.5 text-cream">
          <HelixMark className="h-7 w-7" />
          <span className="text-base font-semibold tracking-tight">Helix</span>
        </Link>

        <div className="hidden items-center gap-3 border-l border-cream/15 pl-4 sm:flex">
          <div>
            <p className="text-sm font-semibold text-cream">Maya</p>
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-cream/35">
              Helix interviewer
            </p>
          </div>
        </div>

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
            {formatClock(Math.min(elapsed, HARD_CAP_MS))}
            <span className="text-cream/25"> / 15:00</span>
          </span>
          <button
            type="button"
            onClick={() => void stop()}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-cream/15 px-3 text-xs font-semibold text-cream/55 transition hover:border-[#dd5f5f]/55 hover:bg-[#dd5f5f]/10 hover:text-cream"
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

      <div
        className={`min-h-0 flex-1 flex-col overflow-hidden ${answerPanelOpen ? "hidden lg:flex" : "flex"}`}
      >
        <div className="pointer-events-none relative flex min-h-[15rem] flex-[0.72] items-center justify-center sm:min-h-[18rem]">
          <div className="h-full max-h-[23rem] w-full max-w-[25rem]">
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

          {!error ? (
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-cream/15 bg-blueprint/80 px-3 py-1.5 shadow-xl backdrop-blur-md">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  status === "live"
                    ? agentState === "thinking"
                      ? "animate-pulse bg-[#e0a13c]"
                      : "bg-[#4bab7c]"
                    : status === "error"
                      ? "bg-[#dd5f5f]"
                      : "animate-pulse bg-cream/50"
                }`}
              />
              <span className="whitespace-nowrap text-xs font-medium text-cream/70">
                {statusLabel}
              </span>
            </div>
          ) : null}
        </div>

        <div className="thin-scroll fade-top max-h-[35vh] w-full shrink-0 space-y-4 overflow-y-auto pb-1 pr-1">
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

          {latestAgentTurn ? (
            <ConversationFocus
              agentTurn={latestAgentTurn}
              userTurn={latestUserTurn}
              setup={setup}
              question={currentQuestion}
              thinking={agentState === "thinking"}
            />
          ) : null}

          <div ref={bottomRef} />
        </div>
      </div>

      {answerPanelOpen ? (
        <TypedAnswerPanel
          question={currentQuestion}
          prompt={latestAgentTurn?.text ?? currentQuestion?.text ?? ""}
          draft={typedDraft}
          notes={typedNotes}
          sending={typedSending}
          error={typedError}
          onDraftChange={setTypedDraft}
          onNotesChange={setTypedNotes}
          onClose={() => {
            if (typedSending) return;
            setAnswerPanelOpen(false);
            setTypedStartedAt(null);
          }}
          onSubmit={() => void submitTypedAnswer()}
        />
      ) : null}

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
          <p className="text-sm font-medium text-cream">
            {micOn && micSignal && status === "live" ? "Maya can hear you" : statusLabel}
          </p>
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

        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <div className="hidden w-[12rem] sm:block">
            <MicrophonePicker
              devices={audioInputs}
              selectedId={selectedInputId}
              disabled={!micAvailable || switchingMic}
              onChange={(deviceId) => void switchMicrophone(deviceId)}
            />
          </div>
          <button
            type="button"
            onClick={() => void openTypedAnswer()}
            disabled={status !== "live" || agentSpeaking || typedSending || answerPanelOpen}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-cream/25 px-3 text-xs font-semibold text-cream/70 transition hover:border-cream/60 hover:bg-cream/[0.07] hover:text-cream disabled:opacity-30"
          >
            <Keyboard size={15} aria-hidden="true" />
            <span className="hidden sm:inline">
              {currentQuestion?.kind === "code" ? "Write solution" : "Type answer"}
            </span>
          </button>
        </div>
      </div>
    </Shell>
  );
}

function TypedAnswerPanel({
  question,
  prompt,
  draft,
  notes,
  sending,
  error,
  onDraftChange,
  onNotesChange,
  onClose,
  onSubmit
}: {
  question: InterviewQuestion | null;
  prompt: string;
  draft: string;
  notes: string;
  sending: boolean;
  error: string | null;
  onDraftChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const isCode = question?.kind === "code";
  const canSubmit = draft.trim().length > 0 && !sending;

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && canSubmit) {
      event.preventDefault();
      onSubmit();
    }
  }

  return (
    <section className="msg-in mb-3 shrink-0 overflow-hidden rounded-2xl border border-cream/20 bg-[#14245c]/95 shadow-[0_-18px_60px_rgba(7,16,54,0.5)] backdrop-blur-xl">
      <div className="flex items-center gap-3 border-b border-cream/12 px-4 py-3 sm:px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-cream/20 bg-cream/[0.06] text-cream">
          {isCode ? (
            <Code2 size={15} aria-hidden="true" />
          ) : (
            <Keyboard size={15} aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-cream">
            {isCode ? "Write your solution" : "Answer in writing"}
          </p>
          <p className="mt-0.5 line-clamp-1 text-[11px] text-cream/40">
            {prompt || "Microphone paused while you type"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={sending}
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-cream/45 transition hover:bg-cream/10 hover:text-cream disabled:opacity-30"
          aria-label="Close typed answer"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      {isCode ? (
        <div className="grid max-h-[58dvh] min-h-0 lg:max-h-[42dvh] lg:grid-cols-[minmax(0,1.35fr)_minmax(15rem,0.65fr)]">
          <label className="min-h-0 border-b border-cream/10 lg:border-b-0 lg:border-r">
            <span className="sr-only">Code solution</span>
            <textarea
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={onKeyDown}
              autoFocus
              spellCheck={false}
              maxLength={6500}
              className="thin-scroll h-64 w-full resize-none bg-[#08143e] p-4 font-mono text-[12px] leading-6 text-[#d8e2ff] outline-none placeholder:text-cream/20 lg:h-full lg:min-h-56"
            />
          </label>
          <label className="flex min-h-0 flex-col p-4">
            <span className="font-mono text-[9px] uppercase tracking-[0.17em] text-cream/38">
              Explain your decision
            </span>
            <textarea
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
              onKeyDown={onKeyDown}
              rows={4}
              maxLength={1200}
              placeholder="What did you change, why is it correct, and how would you verify it?"
              className="mt-3 min-h-24 flex-1 resize-none rounded-xl border border-cream/15 bg-black/10 p-3 text-sm leading-6 text-cream outline-none placeholder:text-cream/25 focus:border-cream/40"
            />
          </label>
        </div>
      ) : (
        <label className="block p-4 sm:p-5">
          <span className="sr-only">Typed answer</span>
          <textarea
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={onKeyDown}
            rows={4}
            autoFocus
            maxLength={6500}
            placeholder="Write your answer here..."
            className="thin-scroll w-full resize-none rounded-xl border border-cream/15 bg-black/10 p-4 text-[15px] leading-7 text-cream outline-none placeholder:text-cream/25 focus:border-cream/45"
          />
        </label>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-cream/12 px-4 py-3 sm:px-5">
        {error ? <p className="text-xs text-[#ffb4b4]">{error}</p> : null}
        <p className="hidden font-mono text-[9px] uppercase tracking-[0.13em] text-cream/28 sm:block">
          Cmd/Ctrl + Enter to submit
        </p>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="ml-auto inline-flex min-h-10 items-center gap-2 rounded-lg border border-cream bg-cream px-4 text-xs font-semibold text-blueprint transition hover:bg-white disabled:pointer-events-none disabled:opacity-35"
        >
          {sending ? (
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          ) : (
            <Send size={14} aria-hidden="true" />
          )}
          {sending ? "Maya is reviewing" : isCode ? "Submit solution" : "Submit answer"}
        </button>
      </div>
    </section>
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
function ConversationFocus({
  agentTurn,
  userTurn,
  setup,
  question,
  thinking
}: {
  agentTurn: Turn;
  userTurn: Turn | null;
  setup: InterviewSetup | null;
  question: InterviewQuestion | null;
  thinking: boolean;
}) {
  const isCode = question?.kind === "code" && question.codeSnippet;

  return (
    <section className="msg-in overflow-hidden rounded-2xl border border-cream/15 bg-cream/[0.045] shadow-[0_16px_36px_-22px_rgba(7,16,54,0.9)] backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-cream/10 px-5 py-3">
        <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-cream/45">
          {isCode ? (
            <Code2 size={12} aria-hidden="true" />
          ) : (
            <BriefcaseBusiness size={12} aria-hidden="true" />
          )}
          {isCode ? "Live coding task" : "Current question"}
        </span>

        {setup ? (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <ContextPill>{roleLabel(setup.role)}</ContextPill>
            <ContextPill>{roundLabel(setup.roundType)}</ContextPill>
          </div>
        ) : null}
      </div>

      {isCode ? (
        <div className="grid min-h-0 lg:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)]">
          <div className="px-5 py-5 sm:px-6 sm:py-6">
            <p className="text-[clamp(1.05rem,2.1vw,1.35rem)] font-medium leading-8 text-cream">
              {agentTurn.text}
            </p>
            <p className="mt-4 text-sm leading-6 text-cream/58">{question.codeTask}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <ContextPill>{question.language ?? "code"}</ContextPill>
              {question.competency ? <ContextPill>{question.competency}</ContextPill> : null}
            </div>
            {thinking ? <ThinkingLine /> : null}
          </div>
          <div className="border-t border-cream/10 bg-[#121f52]/65 p-3 lg:border-l lg:border-t-0">
            <CodeBlock code={question.codeSnippet ?? ""} language={question.language ?? "code"} />
          </div>
        </div>
      ) : (
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_15rem]">
          <div className="px-5 py-5 sm:px-6 sm:py-6">
            <p className="text-[clamp(1.05rem,2.1vw,1.35rem)] font-medium leading-8 text-cream">
              {agentTurn.text}
            </p>
            {thinking ? <ThinkingLine /> : null}
          </div>

          <div className="border-t border-cream/10 bg-black/10 px-5 py-4 lg:border-l lg:border-t-0">
            <p className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-cream/35">
              <ShieldCheck size={11} aria-hidden="true" />
              Private session
            </p>
            <p className="mt-3 line-clamp-3 text-xs leading-5 text-cream/45">
              {userTurn?.text ?? "Your answers appear here after each completed response."}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function ThinkingLine() {
  return (
    <p className="mt-4 flex items-center gap-2 text-xs text-cream/40">
      <Loader2 size={12} className="animate-spin" aria-hidden="true" />
      Following the strongest thread in your answer
    </p>
  );
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-cream/15 bg-[#08143e] shadow-inner">
      <div className="flex items-center justify-between border-b border-cream/10 px-4 py-2.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-cream/42">
          {language}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-cream/25">
          review target
        </span>
      </div>
      <pre className="thin-scroll max-h-72 overflow-auto p-4 text-[12px] leading-6 text-[#d8e2ff]">
        <code>
          {code.split("\n").map((line, index) => (
            <span key={index} className="block whitespace-pre">
              <span className="mr-4 inline-block w-5 select-none text-right text-cream/20">
                {index + 1}
              </span>
              {line || " "}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

function ContextPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-cream/15 px-2.5 py-1 text-[10px] font-medium text-cream/45">
      {children}
    </span>
  );
}

function SessionLoadingScreen({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <Shell>
      <StateHeader />
      <section className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-lg text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-cream/15 bg-cream/[0.05] text-cream/70">
            {error ? (
              <WifiOff size={20} aria-hidden="true" />
            ) : (
              <Loader2 size={20} className="animate-spin" aria-hidden="true" />
            )}
          </span>
          <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-cream/38">
            Secure interview room
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-cream sm:text-3xl">
            {error ? "The room could not be loaded" : "Preparing your interview"}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-cream/48">
            {error ?? "Checking your session and getting Maya ready. This usually takes a moment."}
          </p>
          {error ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-lg bg-cream px-5 text-sm font-semibold text-[#10131a] transition hover:bg-white"
            >
              <RefreshCw size={15} aria-hidden="true" />
              Try again
            </button>
          ) : (
            <div className="mx-auto mt-7 h-1 w-28 overflow-hidden rounded-full bg-cream/10">
              <span className="interview-loading-bar block h-full w-1/2 rounded-full bg-cream/70" />
            </div>
          )}
        </div>
      </section>
    </Shell>
  );
}

function SessionStateScreen({
  kind,
  duration = 0,
  answers = 0
}: {
  kind: "expired" | "complete";
  duration?: number;
  answers?: number;
}) {
  const complete = kind === "complete";

  return (
    <Shell>
      <StateHeader />
      <section className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-2xl text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cream/15 bg-cream/[0.05] text-cream">
            {complete ? (
              <CheckCircle2 size={24} aria-hidden="true" />
            ) : (
              <Clock3 size={24} aria-hidden="true" />
            )}
          </span>
          <p className="mt-7 font-mono text-[10px] uppercase tracking-[0.2em] text-cream/38">
            {complete ? "Session saved" : "Session closed"}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-cream sm:text-5xl">
            {complete ? "Interview complete" : "This interview has expired"}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-cream/50 sm:text-base">
            {complete
              ? "Your conversation has been saved. Start another round when you are ready to practice a different role or interview style."
              : "Interview rooms close after their session window. Start a fresh round to reconnect with Maya."}
          </p>

          {complete ? (
            <div className="mx-auto mt-8 flex w-fit items-center divide-x divide-cream/12 border-y border-cream/12 py-3">
              <StateMetric label="Duration" value={formatClock(duration)} />
              <StateMetric label="Answers" value={String(answers)} />
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/interview"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-cream px-5 text-sm font-semibold text-[#10131a] transition hover:bg-white"
            >
              {complete ? "Practice another round" : "Start a new interview"}
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center rounded-lg border border-cream/15 px-5 text-sm font-semibold text-cream/60 transition hover:border-cream/35 hover:text-cream"
            >
              Return to Helix
            </Link>
          </div>
        </div>
      </section>
    </Shell>
  );
}

function StateMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-28 px-6 text-left">
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-cream/32">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-cream">{value}</p>
    </div>
  );
}

function StateHeader() {
  return (
    <header className="flex items-center border-b border-cream/10 pb-5">
      <Link href="/" className="flex items-center gap-2.5 text-cream">
        <HelixMark className="h-7 w-7" />
        <span className="text-base font-semibold tracking-tight">Helix</span>
      </Link>
      <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.18em] text-cream/30">
        Interview studio
      </span>
    </header>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="blueprint relative h-[100dvh] overflow-hidden px-4 sm:px-8">
      <div className="blueprint-glow" />
      <div className="relative z-10 mx-auto flex h-full w-full max-w-7xl flex-col pt-6">
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

function formatTypedAnswer(
  question: InterviewQuestion | null,
  draft: string,
  notes: string
): string {
  const answer = draft.trim();
  if (!answer) return "";
  if (question?.kind !== "code") return answer;

  const language = question.language ?? "code";
  const reasoning = notes.trim();
  return [`\`\`\`${language}\n${answer}\n\`\`\``, reasoning ? `Reasoning: ${reasoning}` : ""]
    .filter(Boolean)
    .join("\n\n");
}

function roleLabel(role: InterviewSetup["role"]): string {
  const labels: Record<InterviewSetup["role"], string> = {
    backend: "Backend",
    frontend: "Frontend",
    fullstack: "Full-stack",
    data: "Data",
    "ai-ml": "AI / ML",
    pm: "Product"
  };
  return labels[role];
}

function roundLabel(round: InterviewSetup["roundType"]): string {
  const labels: Record<InterviewSetup["roundType"], string> = {
    behavioral: "Behavioral",
    technical: "Technical deep-dive",
    "hiring-manager": "Hiring manager"
  };
  return labels[round];
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
