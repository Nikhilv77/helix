"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import type {
  AudioCaptureOptions,
  RemoteParticipant,
  RemoteTrack,
  TranscriptionSegment
} from "livekit-client";
import {
  Code2,
  Keyboard,
  Loader2,
  Mic,
  MicOff,
  Play,
  RefreshCw,
  Send,
  Square,
  Volume2
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
import type { AgentState, DsaLanguage, DsaRunResult, VoiceStatus } from "./types";
import {
  describeVoiceState,
  formatClock,
  formatTypedAnswer,
  isAgentState,
  updateLiveTranscript
} from "./utils/voice-interview";
import { SessionLoadingScreen, SessionStateScreen, VoiceShell } from "./components/session-state";
import { MicrophonePicker } from "./components/microphone-picker";
import { TypedAnswerPanel } from "./components/typed-answer-panel";
import { ConversationTranscript } from "./components/conversation-transcript";
import { useInterviewClock } from "./hooks/use-interview-clock";

const HARD_CAP_MS = 15 * 60 * 1000;
const AVATAR_URL = process.env.NEXT_PUBLIC_AVATAR_URL ?? "";
const POLL_MS = 1500;
const AGENT_STATE_ATTRIBUTE = "lk.agent.state";
const AGENT_JOIN_TIMEOUT_MS = 15_000;
const MIC_SILENCE_WARNING_MS = 6_000;
const MIC_DEVICE_STORAGE_KEY = "trailgrad.preferredMicrophone";
const TYPED_ANSWER_TOPIC = "trailgrad.typed-answer";

function turnKey(turn: Turn): string {
  return `${turn.speaker}-${turn.startMs}-${turn.endMs}-${turn.text}`;
}

export function VoiceInterviewClient() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params?.get("session") ?? null;

  const [status, setStatus] = useState<VoiceStatus>("connecting");
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
  const elapsed = useInterviewClock({
    startedAt,
    disabled: sessionUnavailable || status === "ended" || status === "error",
    hardCapMs: HARD_CAP_MS
  });
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
    <VoiceShell>
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
    </VoiceShell>
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


function microphoneOptions(deviceId = ""): AudioCaptureOptions {
  return {
    autoGainControl: true,
    echoCancellation: true,
    noiseSuppression: true,
    channelCount: 1,
    ...(deviceId ? { deviceId: { exact: deviceId } } : {})
  };
}
