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
  Play,
  RefreshCw,
  Send,
  Square,
  Volume2,
  WifiOff,
  X
} from "lucide-react";
import { TrailgradMark } from "@/components/trailgrad-mark";
import { DsaCodeEditor } from "@/components/interview/dsa-code-editor";
import { DsaQuestionNotes } from "@/components/interview/dsa-question-notes";
import { PathRail } from "@/components/interview/path-rail";
import { MicMeter } from "@/components/interview/mic-meter";
import { InterviewerPresence } from "@/components/interview/interviewer-presence";
import { AvatarStage } from "@/components/interview/avatar-stage";
import type { PresenceState } from "@/components/interview/interviewer-presence";
import { ApiClientError, endInterview, getSession } from "@/lib/api-client";
import { findQuestion } from "@/lib/dsa";
import type { DsaQuestion } from "@/lib/dsa";
import { dsaStarterCode } from "@/lib/dsa-code-templates";
import { pageTitle } from "@/lib/seo";
import type { InterviewQuestion, InterviewSetup, Phase, Turn } from "@/lib/types";

const HARD_CAP_MS = 15 * 60 * 1000;
const AVATAR_URL = process.env.NEXT_PUBLIC_AVATAR_URL ?? "";
const POLL_MS = 1500;
const AGENT_STATE_ATTRIBUTE = "lk.agent.state";
const AGENT_JOIN_TIMEOUT_MS = 15_000;
const MIC_SILENCE_WARNING_MS = 6_000;
const MIC_DEVICE_STORAGE_KEY = "trailgrad.preferredMicrophone";
const TYPED_ANSWER_TOPIC = "trailgrad.typed-answer";
type DsaLanguage = "python" | "javascript" | "cpp" | "java";
type DsaRunResult = {
  status: string;
  accepted: boolean;
  stdout: string;
  stderr: string;
  compileOutput: string;
  time: string | null;
  memory: number | null;
  tests: Array<{
    index: number;
    input: string;
    expectedOutput: string;
    actualOutput: string;
    passed: boolean;
    error: string | null;
  }>;
};

type Status = "connecting" | "waiting" | "live" | "reconnecting" | "ended" | "error";
type AgentState = "initializing" | "idle" | "listening" | "thinking" | "speaking";

export default function VoiceInterviewPage() {
  return (
    <Suspense fallback={null}>
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
  const [optimisticUserTurn, setOptimisticUserTurn] = useState<Turn | null>(null);
  const [spokenAgentTurnKeys, setSpokenAgentTurnKeys] = useState<Set<string>>(new Set());
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
  const [dsaLanguage, setDsaLanguage] = useState<DsaLanguage>("javascript");
  const [dsaRunResult, setDsaRunResult] = useState<DsaRunResult | null>(null);
  const [dsaRunning, setDsaRunning] = useState(false);

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
  const localTranscriptSegmentsRef = useRef<Map<string, TranscriptionSegment>>(new Map());
  const turnsRef = useRef<Turn[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const typedUserTurnsRef = useRef(0);
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const dsaQuestionSlug = setup?.dsaQuestionSlugs?.[progress.index] ?? null;

  const revealAgentTurn = useCallback((turn: Turn | null | undefined) => {
    if (!turn || turn.speaker !== "agent") return;
    const key = turnKey(turn);
    setSpokenAgentTurnKeys((current) => {
      if (current.has(key)) return current;
      return new Set(current).add(key);
    });
  }, []);

  const revealLatestAgentTurn = useCallback(() => {
    revealAgentTurn([...turnsRef.current].reverse().find((turn) => turn.speaker === "agent"));
  }, [revealAgentTurn]);

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
    if (sessionUnavailable || sessionCompleteRef.current) return;

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
        if (next === "speaking") revealLatestAgentTurn();
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
        localTranscriptSegmentsRef.current,
        setLiveTranscript,
        (text) => {
          const now = startedAtRef.current ? Math.max(0, Date.now() - startedAtRef.current) : 0;
          setOptimisticUserTurn({
            speaker: "user",
            text,
            startMs: now,
            endMs: now
          });
        }
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
      turnsRef.current = session.turns;
      setTurns(session.turns);
      setOptimisticUserTurn((pending) =>
        pending &&
        session.turns.some(
          (turn) => turn.speaker === "user" && turn.text.trim() === pending.text.trim()
        )
          ? null
          : pending
      );
      setPhase(session.phase);
      setSetup(session.setup);
      setCurrentQuestion(session.currentQuestion);
      setStartedAt(session.startedAt);
      startedAtRef.current = session.startedAt;
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
    if (agentState === "speaking") revealLatestAgentTurn();
  }, [agentState, revealLatestAgentTurn, turns]);

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
    if (setup?.templateTitle === "DSA practice interview") {
      setTypedStartedAt(Date.now());
      return;
    }
    setAnswerPanelOpen(false);
    setTypedDraft("");
    setTypedNotes("");
    setTypedStartedAt(null);
  }, [setup?.templateTitle, turns, typedSending]);

  useEffect(() => {
    if (setup?.templateTitle !== "DSA practice interview" || !dsaQuestionSlug) return;
    const question = findQuestion(dsaQuestionSlug)?.question;
    setTypedDraft(question ? dsaStarterCode(question.slug, dsaLanguage) : "");
    setTypedNotes("");
    setTypedError(null);
    setDsaRunResult(null);
    setTypedStartedAt(Date.now());
  }, [dsaLanguage, dsaQuestionSlug, setup?.templateTitle]);

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
  }, [liveTranscript, turns]);

  useEffect(() => {
    if (agentState === "speaking") {
      localTranscriptSegmentsRef.current.clear();
      setLiveTranscript("");
    }
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

  async function submitDsaAnswer() {
    const room = roomRef.current;
    const code = typedDraft.trim();
    if (!room || !sessionId || !startedAt || code.length < 10 || typedSending) return;

    const now = Date.now();
    const startMs = Math.max(0, (typedStartedAt ?? now) - startedAt);
    const endMs = Math.max(startMs, now - startedAt);
    const reasoning = typedNotes.trim();
    const answer = [
      `\`\`\`${dsaLanguage}\n${code}\n\`\`\``,
      reasoning ? `Reasoning and complexity: ${reasoning}` : ""
    ]
      .filter(Boolean)
      .join("\n\n");
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
      setTypedError(caught instanceof Error ? caught.message : "The solution could not be sent.");
    }
  }

  async function runDsaCode() {
    if (!typedDraft.trim() || !dsaQuestionSlug || dsaRunning) return;
    setDsaRunning(true);
    setDsaRunResult(null);
    setTypedError(null);
    try {
      const response = await fetch("/api/code/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: typedDraft,
          language: dsaLanguage,
          slug: dsaQuestionSlug,
          stdin: ""
        })
      });
      const payload = (await response.json()) as {
        success?: boolean;
        data?: DsaRunResult;
        error?: { message?: string };
      };
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message || "Judge0 could not run this code.");
      }
      setDsaRunResult(payload.data);
    } catch (caught) {
      setTypedError(caught instanceof Error ? caught.message : "Code execution failed.");
    } finally {
      setDsaRunning(false);
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
    localTranscriptSegmentsRef.current.clear();
    setLiveTranscript("");

    const existing = roomRef.current;
    roomRef.current = null;
    intentionalDisconnectRef.current = true;
    await existing?.disconnect().catch(() => null);
    intentionalDisconnectRef.current = false;
    setConnectionAttempt((attempt) => attempt + 1);
  }

  const overCap = elapsed >= HARD_CAP_MS;
  const latestAgentTurn = [...turns].reverse().find((turn) => turn.speaker === "agent") ?? null;
  const optimisticAlreadyPersisted = optimisticUserTurn
    ? turns.some(
        (turn) => turn.speaker === "user" && turn.text.trim() === optimisticUserTurn.text.trim()
      )
    : false;
  const displayTurns =
    optimisticUserTurn && !optimisticAlreadyPersisted ? [...turns, optimisticUserTurn] : turns;

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
  const isDsaInterview = setup?.templateTitle === "DSA practice interview";
  const selectedDsaSlug = setup?.dsaQuestionSlugs?.[progress.index];
  const dsaQuestion =
    isDsaInterview && selectedDsaSlug
      ? findQuestion(selectedDsaSlug)?.question ?? null
      : null;

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
          <TrailgradMark className="h-7 w-7" />
          <span className="text-base font-semibold tracking-tight">Trailgrad</span>
        </Link>

        <div className="hidden items-center gap-3 border-l border-cream/15 pl-4 sm:flex">
          <div>
            <p className="text-sm font-semibold text-cream">Maya</p>
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-cream/35">
              Trailgrad interviewer
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
            className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-cream/[0.045] px-3 text-xs font-semibold text-cream/55 transition hover:bg-[#dd5f5f]/10 hover:text-cream"
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

      {isDsaInterview ? (
        <DsaLiveWorkspace
          question={dsaQuestion}
          questionSlug={selectedDsaSlug ?? null}
          turns={displayTurns}
          spokenAgentTurnKeys={spokenAgentTurnKeys}
          liveUserText={liveTranscript}
          startedAt={startedAt}
          setup={setup}
          currentQuestion={currentQuestion}
          questionIndex={progress.index}
          questionCount={progress.count}
          thinking={agentState === "thinking"}
          bottomRef={bottomRef}
          agentTrack={agentTrack}
          localTrack={localTrack}
          presence={presence}
          language={dsaLanguage}
          runResult={dsaRunResult}
          running={dsaRunning}
          onLanguageChange={(language) => setDsaLanguage(language)}
          onRun={() => void runDsaCode()}
          draft={typedDraft}
          notes={typedNotes}
          sending={typedSending}
          error={typedError}
          onDraftChange={setTypedDraft}
          onNotesChange={setTypedNotes}
          onSubmit={() => void submitDsaAnswer()}
        />
      ) : (
      <div
        className={`min-h-0 flex-1 gap-4 overflow-hidden ${
          answerPanelOpen ? "hidden lg:grid" : "grid"
        } lg:grid-cols-[minmax(17rem,0.82fr)_minmax(0,1.18fr)]`}
      >
        <section className="relative min-h-[18rem] overflow-hidden sm:min-h-[22rem] lg:min-h-0">
          <div className="pointer-events-none absolute inset-4 flex items-center justify-center sm:inset-6">
            <div className="h-full max-h-[28rem] w-full max-w-[29rem]">
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

          {!error ? (
            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-cream/[0.055] px-3 py-1.5">
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
        </section>

        <section className="thin-scroll fade-top min-h-0 space-y-4 overflow-y-auto p-0 pr-1">
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
            <div className="rounded-xl bg-[#dd5f5f]/10 px-4 py-3">
              <p className="text-sm text-cream">{error}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {!sessionUnavailable ? (
                  <button
                    type="button"
                    onClick={() => void reconnect()}
                    className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-cream/[0.06] px-3 text-xs font-semibold text-cream transition hover:bg-cream/10"
                  >
                    <RefreshCw size={13} aria-hidden="true" />
                    Reconnect
                  </button>
                ) : null}
                <Link href="/interview?resume=1" className="text-xs text-cream/60 underline">
                  Start over
                </Link>
              </div>
            </div>
          ) : null}

          {playbackBlocked ? (
            <div className="rounded-xl bg-cream/[0.06] px-4 py-3">
              <p className="text-sm leading-6 text-cream">
                Your browser paused call audio. Enable it once and the conversation will continue.
              </p>
              <button
                type="button"
                onClick={() => audioRetryRef.current?.()}
                className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-lg bg-cream/[0.06] px-3 text-xs font-semibold text-cream transition hover:bg-cream/10"
              >
                <Volume2 size={14} aria-hidden="true" />
                Enable audio
              </button>
            </div>
          ) : null}

          {micError ? (
            <div className="rounded-xl bg-[#e0a13c]/10 px-4 py-3">
              <p className="text-sm leading-6 text-cream">{micError}</p>
              <button
                type="button"
                onClick={() => micRetryRef.current?.()}
                className="mt-2 inline-flex min-h-9 items-center rounded-lg bg-cream/[0.06] px-3 text-xs font-semibold text-cream transition hover:bg-cream/10"
              >
                Retry microphone
              </button>
            </div>
          ) : null}

          {micSilent && !micError ? (
            <div className="rounded-xl bg-[#e0a13c]/10 px-4 py-3">
              <p className="text-sm font-medium text-cream">No microphone signal detected</p>
              <p className="mt-1 text-xs leading-5 text-cream/60">
                Trailgrad connected to {selectedInputLabel}, but no audible sound is arriving.
                Choose the microphone you are speaking into.
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

          <ConversationTranscript
            turns={displayTurns}
            spokenAgentTurnKeys={spokenAgentTurnKeys}
            liveUserText={liveTranscript}
            startedAt={startedAt}
            setup={setup}
            question={currentQuestion}
            thinking={agentState === "thinking"}
            bottomRef={bottomRef}
          />
        </section>
      </div>
      )}

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

      <div className="mt-4 flex shrink-0 items-center gap-3 px-1 py-3 sm:gap-4 sm:px-0">
        <button
          type="button"
          onClick={() => void toggleMic()}
          disabled={!micAvailable}
          className={`flex h-12 w-12 items-center justify-center rounded-full transition disabled:opacity-30 ${
            micOn ? "bg-cream text-blueprint" : "bg-cream/[0.055] text-cream/60"
          }`}
          aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
        >
          {micOn ? <Mic size={18} aria-hidden="true" /> : <MicOff size={18} aria-hidden="true" />}
        </button>

        <div className="flex-1">
          <p className="text-sm font-medium text-cream">
            {micOn && micSignal && status === "live" ? "Maya can hear you" : statusLabel}
          </p>
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
          {!isDsaInterview ? <button
            type="button"
            onClick={() => void openTypedAnswer()}
            disabled={status !== "live" || agentSpeaking || typedSending || answerPanelOpen}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-cream/[0.045] px-3 text-xs font-semibold text-cream/70 transition hover:bg-cream/[0.08] hover:text-cream disabled:opacity-30"
          >
            <Keyboard size={15} aria-hidden="true" />
            <span className="hidden sm:inline">
              {currentQuestion?.kind === "code" ? "Write solution" : "Type answer"}
            </span>
          </button> : null}
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
    <section className="msg-in mb-3 shrink-0 overflow-hidden rounded-2xl bg-cream/[0.045]">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cream/[0.06] text-cream">
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
          <label className="min-h-0">
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
              className="mt-3 min-h-24 flex-1 resize-none rounded-xl bg-black/10 p-3 text-sm leading-6 text-cream outline-none placeholder:text-cream/25 focus:bg-black/15"
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
            className="thin-scroll w-full resize-none rounded-xl bg-black/10 p-4 text-[15px] leading-7 text-cream outline-none placeholder:text-cream/25 focus:bg-black/15"
          />
        </label>
      )}

      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
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

function DsaLiveWorkspace({
  question,
  questionSlug,
  turns,
  spokenAgentTurnKeys,
  liveUserText,
  startedAt,
  setup,
  currentQuestion,
  questionIndex,
  questionCount,
  thinking,
  bottomRef,
  agentTrack,
  localTrack,
  presence,
  language,
  runResult,
  running,
  onLanguageChange,
  onRun,
  draft,
  notes,
  sending,
  error,
  onDraftChange,
  onNotesChange,
  onSubmit
}: {
  question: DsaQuestion | null;
  questionSlug: string | null;
  turns: Turn[];
  spokenAgentTurnKeys: ReadonlySet<string>;
  liveUserText: string;
  startedAt: number | null;
  setup: InterviewSetup | null;
  currentQuestion: InterviewQuestion | null;
  questionIndex: number;
  questionCount: number;
  thinking: boolean;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  agentTrack: MediaStreamTrack | null;
  localTrack: MediaStreamTrack | null;
  presence: PresenceState;
  language: DsaLanguage;
  runResult: DsaRunResult | null;
  running: boolean;
  draft: string;
  notes: string;
  sending: boolean;
  error: string | null;
  onDraftChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onLanguageChange: (language: DsaLanguage) => void;
  onRun: () => void;
  onSubmit: () => void;
}) {
  const canSubmit = draft.trim().length >= 10 && !sending;

  return (
    <div className="min-h-0 flex-1 grid gap-4 overflow-hidden lg:grid-cols-[minmax(17rem,0.82fr)_minmax(22rem,1.08fr)_minmax(18rem,0.72fr)]">
      <section className="thin-scroll min-h-0 overflow-y-auto border-r border-cream/10 pr-4">
        <div className="flex items-center justify-between gap-3 border-b border-cream/10 pb-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-cream/50">
            Problem {questionIndex + 1} of {questionCount}
          </span>
          {question ? <span className="text-xs capitalize text-cream/45">{question.difficulty}</span> : null}
        </div>
        {question ? (
          <>
            <h2 className="mt-5 font-display text-2xl font-semibold leading-tight text-cream">
              {question.title}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-cream/50">
              <span>{question.primaryPattern.replace(/-/g, " ")}</span>
              <span aria-hidden="true">·</span>
              <span>{question.expectedTimeMinutes} min</span>
            </div>
            <DsaCopySection title="Description">
              <p>{question.problemStatement ?? question.promptSummary}</p>
            </DsaCopySection>
            {question.examples?.length ? (
              <DsaCopySection title="Examples">
                <div className="space-y-4 font-mono text-xs leading-6 text-cream/70">
                  {question.examples.map((example, index) => (
                    <div key={`${example.input}-${example.output}`}>
                      <p className="mb-1 font-sans font-semibold text-cream/75">Example {index + 1}</p>
                      <p><span className="text-cream/40">Input:</span> {example.input}</p>
                      <p><span className="text-cream/40">Output:</span> {example.output}</p>
                    </div>
                  ))}
                </div>
              </DsaCopySection>
            ) : null}
            {question.constraints?.length ? (
              <DsaCopySection title="Constraints">
                <ul className="space-y-2 font-mono text-xs leading-6 text-cream/70">
                  {question.constraints.map((constraint) => <li key={constraint}>• {constraint}</li>)}
                </ul>
              </DsaCopySection>
            ) : null}
            {questionSlug ? <DsaQuestionNotes slug={questionSlug} /> : null}
          </>
        ) : (
          <p className="mt-6 text-sm leading-6 text-cream/50">Maya is preparing the next problem.</p>
        )}
      </section>

      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-cream/10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cream/10 pb-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-cream">
            <Code2 size={15} aria-hidden="true" className="text-cream/55" />
            Your solution
          </div>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="dsa-language">Language</label>
            <select
              id="dsa-language"
              value={language}
              onChange={(event) => onLanguageChange(event.target.value as DsaLanguage)}
              className="h-8 bg-cream/[0.05] px-2 text-xs text-cream outline-none focus:bg-cream/[0.1]"
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="cpp">C++</option>
              <option value="java">Java</option>
            </select>
            <button
              type="button"
              onClick={onRun}
              disabled={running || !draft.trim()}
              className="inline-flex h-8 items-center gap-1.5 bg-cream px-3 text-xs font-semibold text-blueprint transition hover:bg-white disabled:pointer-events-none disabled:opacity-35"
            >
              {running ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}
              {running ? "Running" : "Run code"}
            </button>
          </div>
        </div>
        <div className="min-h-64 flex-1 overflow-hidden bg-[#172f78]">
          <DsaCodeEditor
            language={language}
            value={draft}
            onChange={onDraftChange}
            onRun={onRun}
          />
        </div>
        <DsaOutputPanel
          examples={question?.examples ?? []}
          result={runResult}
          running={running}
        />
        <div className="border-t border-cream/10 pt-3">
          <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-cream/40">
            Reasoning and complexity
            <textarea
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
              rows={3}
              placeholder="Why is this correct? What are the time and space costs?"
              className="mt-2 w-full resize-none bg-cream/[0.035] p-3 font-sans text-sm leading-6 text-cream outline-none placeholder:text-cream/25 focus:bg-cream/[0.06]"
            />
          </label>
          {error ? <p className="mt-2 text-xs text-[#ffb4b4]">{error}</p> : null}
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 bg-cream px-4 text-sm font-semibold text-blueprint transition hover:bg-white disabled:pointer-events-none disabled:opacity-35"
          >
            {sending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
            {sending ? "Maya is reviewing" : "Send solution to Maya"}
          </button>
        </div>
      </section>

      <aside className="flex min-h-0 flex-col overflow-hidden">
        <div className="relative h-44 shrink-0 overflow-hidden border-b border-cream/10 bg-[#294aa2]/70">
          <div className="absolute inset-x-[-18%] bottom-[-8%] top-0">
            {AVATAR_URL ? (
              <AvatarStage agentTrack={agentTrack} state={presence} url={AVATAR_URL} />
            ) : (
              <InterviewerPresence agentTrack={agentTrack} localTrack={localTrack} state={presence} />
            )}
          </div>
          <div className="relative z-10 flex items-center gap-2 p-4 text-sm font-semibold text-cream">
            <Mic size={15} aria-hidden="true" /> Maya
          </div>
        </div>
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto pt-4">
          <ConversationTranscript
            turns={turns}
            spokenAgentTurnKeys={spokenAgentTurnKeys}
            liveUserText={liveUserText}
            startedAt={startedAt}
            setup={setup}
            question={currentQuestion}
            thinking={thinking}
            bottomRef={bottomRef}
          />
        </div>
      </aside>
    </div>
  );
}

function DsaOutputPanel({
  examples,
  result,
  running
}: {
  examples: NonNullable<DsaQuestion["examples"]>;
  result: DsaRunResult | null;
  running: boolean;
}) {
  return (
    <section className="max-h-64 shrink-0 overflow-hidden border-t border-cream/10 bg-black/10">
      <div className="flex items-center justify-between gap-3 border-b border-cream/10 px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-cream/45">Output</span>
        {running ? (
          <span className="flex items-center gap-1.5 text-xs text-cream/45">
            <Loader2 size={12} className="animate-spin" aria-hidden="true" /> Running tests
          </span>
        ) : result ? (
          <span className={`text-xs font-semibold ${result.accepted ? "text-[#a9f0d0]" : "text-[#ffb4b4]"}`}>
            {result.status}
          </span>
        ) : (
          <span className="text-xs text-cream/30">Run code to check examples</span>
        )}
      </div>
      <div className="thin-scroll max-h-52 overflow-y-auto px-3 py-3">
        {result?.compileOutput || result?.stderr ? (
          <pre className="whitespace-pre-wrap font-mono text-xs leading-5 text-[#ffb4b4]">
            {result.compileOutput || result.stderr}
          </pre>
        ) : result?.tests.length ? (
          <div className="space-y-3">
            {result.tests.map((test) => (
              <div key={test.index} className="border-b border-cream/[0.07] pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-cream/65">Case {test.index + 1}</span>
                  <span className={`text-xs font-semibold ${test.passed ? "text-[#a9f0d0]" : "text-[#ffb4b4]"}`}>
                    {test.passed ? "Passed" : "Failed"}
                  </span>
                </div>
                <dl className="mt-2 grid gap-x-3 gap-y-1 font-mono text-[11px] leading-5 sm:grid-cols-[4.5rem_1fr]">
                  <dt className="text-cream/35">Input</dt><dd className="break-words text-cream/65">{test.input}</dd>
                  <dt className="text-cream/35">Expected</dt><dd className="break-words text-cream/65">{test.expectedOutput}</dd>
                  <dt className="text-cream/35">Output</dt><dd className="break-words text-cream/65">{test.error || test.actualOutput || "No output"}</dd>
                </dl>
              </div>
            ))}
            {result.stdout ? (
              <div>
                <p className="text-xs font-semibold text-cream/50">Console output</p>
                <pre className="mt-1 whitespace-pre-wrap font-mono text-[11px] leading-5 text-cream/55">{result.stdout}</pre>
              </div>
            ) : null}
          </div>
        ) : examples.length ? (
          <div className="space-y-3">
            {examples.slice(0, 10).map((example, index) => (
              <div key={`${example.input}-${index}`} className="border-b border-cream/[0.07] pb-3 last:border-0 last:pb-0">
                <p className="text-xs font-semibold text-cream/55">Case {index + 1}</p>
                <dl className="mt-2 grid gap-x-3 gap-y-1 font-mono text-[11px] leading-5 sm:grid-cols-[4.5rem_1fr]">
                  <dt className="text-cream/35">Input</dt><dd className="break-words text-cream/60">{example.input}</dd>
                  <dt className="text-cream/35">Expected</dt><dd className="break-words text-cream/60">{example.output}</dd>
                </dl>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs leading-5 text-cream/35">No runnable examples are available for this question yet.</p>
        )}
      </div>
    </section>
  );
}

function DsaCopySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-cream/40">{title}</h3>
      <div className="text-sm leading-6 text-cream/75">{children}</div>
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
        className="h-9 w-full truncate rounded-lg bg-cream/[0.045] px-3 text-xs text-cream outline-none transition focus:bg-cream/[0.075] disabled:opacity-40"
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

function ConversationTranscript({
  turns,
  spokenAgentTurnKeys,
  liveUserText,
  startedAt,
  setup,
  question,
  thinking,
  bottomRef
}: {
  turns: Turn[];
  spokenAgentTurnKeys: ReadonlySet<string>;
  liveUserText: string;
  startedAt: number | null;
  setup: InterviewSetup | null;
  question: InterviewQuestion | null;
  thinking: boolean;
  bottomRef: React.RefObject<HTMLDivElement | null>;
}) {
  const visibleTurns = mergeConsecutiveUserTurns(
    turns.filter(
      (turn) =>
        turn.text.trim().length > 0 &&
        (turn.speaker === "user" || spokenAgentTurnKeys.has(turnKey(turn)))
    )
  );
  const normalizedLiveUserText = liveUserText.trim();
  const hasLiveUserTurn = visibleTurns.some(
    (turn) => turn.speaker === "user" && turn.text.trim() === normalizedLiveUserText
  );
  const displayTurns =
    normalizedLiveUserText && !hasLiveUserTurn
      ? [
          ...visibleTurns,
          {
            speaker: "user" as const,
            text: normalizedLiveUserText,
            startMs: startedAt ? Math.max(0, Date.now() - startedAt) : 0,
            endMs: startedAt ? Math.max(0, Date.now() - startedAt) : 0
          }
        ]
      : visibleTurns;
  const isCode = question?.kind === "code" && question.codeSnippet;
  let latestAgentIndex = -1;
  for (let index = displayTurns.length - 1; index >= 0; index -= 1) {
    if (displayTurns[index]?.speaker === "agent") {
      latestAgentIndex = index;
      break;
    }
  }

  return (
    <section className="msg-in flex min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-3 px-1 pb-4">
        <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-cream/62">
          {isCode ? (
            <Code2 size={12} aria-hidden="true" />
          ) : (
            <BriefcaseBusiness size={12} aria-hidden="true" />
          )}
          Live exchange
        </span>

        {setup ? (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <ContextPill>{roleLabel(setup.role)}</ContextPill>
            <ContextPill>{roundLabel(setup.roundType)}</ContextPill>
          </div>
        ) : null}
      </div>

      {displayTurns.length === 0 ? (
        <div className="rounded-xl bg-cream/[0.045] px-5 py-5">
          <p className="text-base leading-7 text-cream sm:text-lg sm:leading-8">
            {question
              ? "Maya is getting ready to speak."
              : "Maya is preparing your first question."}
          </p>
          {question?.codeTask ? (
            <p className="mt-4 text-sm leading-6 text-cream/60">{question.codeTask}</p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-5">
          {displayTurns.map((turn, index) => {
            const isAgent = turn.speaker === "agent";
            const isLatestAgent = isAgent && index === latestAgentIndex;

            return (
              <article
                key={`${turn.speaker}-${turn.startMs}-${index}`}
                className={`flex ${isAgent ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[min(100%,44rem)] ${
                    isLatestAgent
                      ? "rounded-xl bg-cream/[0.06] px-4 py-3"
                      : isAgent
                        ? "px-1"
                        : "rounded-xl bg-black/10 px-4 py-3"
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className={`font-mono text-[9px] uppercase tracking-[0.18em] ${
                        isAgent ? "text-cream/60" : "text-cream/38"
                      }`}
                    >
                      {isAgent ? "Maya" : "You"}
                    </span>
                    <span className="font-mono text-[9px] text-cream/25">
                      {formatClock(turn.startMs)}
                    </span>
                  </div>

                  <TypewriterText
                    active={isLatestAgent}
                    className={
                      isLatestAgent
                        ? "text-base leading-7 text-cream sm:text-lg sm:leading-8"
                        : isAgent
                          ? "text-base leading-7 text-cream/82"
                          : "text-sm leading-6 text-cream/68"
                    }
                    text={turn.text}
                  />
                </div>
              </article>
            );
          })}

          {isCode ? (
            <div className="rounded-xl bg-black/10 p-3">
              <CodeBlock code={question.codeSnippet ?? ""} language={question.language ?? "code"} />
            </div>
          ) : null}

          {thinking ? <ThinkingLine /> : null}
          <div ref={bottomRef} />
        </div>
      )}
    </section>
  );
}

function turnKey(turn: Turn): string {
  return `${turn.speaker}-${turn.startMs}-${turn.endMs}-${turn.text}`;
}

function mergeConsecutiveUserTurns(turns: Turn[]): Turn[] {
  return turns.reduce<Turn[]>((merged, turn) => {
    const previous = merged.at(-1);
    if (turn.speaker !== "user" || previous?.speaker !== "user") {
      merged.push({ ...turn });
      return merged;
    }

    previous.text = mergeTranscriptText(previous.text, turn.text);
    previous.endMs = Math.max(previous.endMs, turn.endMs);
    return merged;
  }, []);
}

function mergeTranscriptText(existing: string, incoming: string): string {
  const current = existing.trim();
  const next = incoming.trim();

  if (!current || next.startsWith(current)) return next;
  if (current.startsWith(next)) return current;
  return `${current} ${next}`;
}

function TypewriterText({
  text,
  active,
  className
}: {
  text: string;
  active: boolean;
  className: string;
}) {
  const [visibleText, setVisibleText] = useState(active ? "" : text);

  useEffect(() => {
    if (!active) {
      setVisibleText(text);
      return;
    }

    setVisibleText("");
    let nextLength = 0;
    const stepMs = 42;
    const timer = window.setInterval(() => {
      nextLength += 1;
      setVisibleText(text.slice(0, nextLength));

      if (nextLength >= text.length) {
        window.clearInterval(timer);
      }
    }, stepMs);

    return () => window.clearInterval(timer);
  }, [active, text]);

  return (
    <p className={className}>
      {visibleText}
      {active && visibleText.length < text.length ? (
        <span className="ml-0.5 animate-pulse text-cream/55">|</span>
      ) : null}
    </p>
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
    <div className="overflow-hidden rounded-xl bg-black/15">
      <div className="flex items-center justify-between px-4 py-2.5">
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
    <span className="rounded-full bg-cream/[0.055] px-2.5 py-1 text-[10px] font-medium text-cream/45">
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
              href="/interview?resume=1"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-cream px-5 text-sm font-semibold text-[#10131a] transition hover:bg-white"
            >
              {complete ? "Practice another round" : "Start a new interview"}
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center rounded-lg border border-cream/15 px-5 text-sm font-semibold text-cream/60 transition hover:border-cream/35 hover:text-cream"
            >
              Return to Trailgrad
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
        <TrailgradMark className="h-7 w-7" />
        <span className="text-base font-semibold tracking-tight">Trailgrad</span>
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
  accumulatedSegments: Map<string, TranscriptionSegment>,
  update: (text: string) => void,
  onFinal?: (text: string) => void
) {
  if (!participant || participant.identity === agentIdentity) return;
  if (participant.identity !== room.localParticipant.identity) return;

  for (const segment of segments) {
    accumulatedSegments.set(segment.id, segment);
  }

  const text = [...accumulatedSegments.values()]
    .map((segment) => segment.text.trim())
    .filter(Boolean)
    .join(" ")
    .trim();

  if (text) {
    update(text);
    if (segments.some((segment) => segment.final)) onFinal?.(text);
  }
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
  if (agentState === "thinking") return "Trailgrad is thinking";
  if (agentState === "speaking" || activeSpeakerFallback) return "Trailgrad is speaking";
  if (!micOn) return "Microphone muted";
  if (micSignal) return "Hearing you";
  if (micSilent) return "No microphone signal";
  return "Listening. Speak now";
}
