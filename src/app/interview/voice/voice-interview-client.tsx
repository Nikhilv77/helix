"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import type {
  AudioCaptureOptions,
  RemoteParticipant,
  RemoteTrack,
  TranscriptionSegment
} from "livekit-client";
import {
  Code2,
  GripVertical,
  Keyboard,
  Loader2,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Play,
  RefreshCw,
  Send,
  Square,
  Volume2
} from "lucide-react";
import { DsaCodeEditor } from "@/components/interview/dsa/dsa-code-editor";
import { DsaQuestionNotes } from "@/components/interview/dsa/dsa-question-notes";
import { ResizableTextarea } from "@/components/interview/dsa/resizable-textarea";
import { PathRail } from "@/components/interview/shared/path-rail";
import { MicMeter } from "@/components/interview/voice/mic-meter";
import { InterviewerPresence } from "@/components/interview/voice/interviewer-presence";
import { personaById, personaForSession } from "@/lib/avatars/personas";
import { useWorkspaceTeacher } from "@/lib/avatars/teacher-context";
import { AvatarStage } from "@/components/interview/voice/avatar-stage";
import type { PresenceState } from "@/components/interview/voice/interviewer-presence";
import {
  ApiClientError,
  endInterview,
  getSession,
  skipDsaBlockAssessmentCode
} from "@/lib/api/api-client";
import { findQuestion } from "@/lib/dsa/dsa";
import { dsaStarterCode } from "@/lib/dsa/dsa-code-templates";
import { pageTitle } from "@/lib/shared/seo";
import type {
  CandidateResume,
  InterviewConcept,
  InterviewQuestion,
  InterviewSetup,
  InterviewStage,
  Phase,
  Turn
} from "@/lib/shared/types";
import { MayaAside } from "./components/maya-aside";
import { INTERVIEW_PANEL_RULE, INTERVIEW_PANEL_SHELL } from "./components/panel-surface";
import { ResumeLiveWorkspace, resumeEditorLanguage } from "./components/resume-live-workspace";
import { stageCounts } from "./components/interview-question-panel";
import { FundamentalsLiveWorkspace } from "./components/fundamentals-live-workspace";
import { BlockAssessmentReviewWorkspace } from "./components/block-assessment-review-workspace";
import type { WorkspaceAccent } from "@/lib/workspace/accent";
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
import { CandidateCameraPreview } from "./components/candidate-camera-preview";
import { MediaPermissionGate, type MediaSetupResult } from "./components/media-permission-gate";
import { useInterviewClock } from "./hooks/use-interview-clock";

const DEFAULT_HARD_CAP_MS = 15 * 60 * 1000;
/**
 * Normally empty: the interviewer comes from the session's persona. Set it to a
 * path to pin one model across every session while previewing a replacement,
 * or to "off" to fall back to the non-3D presence indicator.
 */
const AVATAR_OVERRIDE = process.env.NEXT_PUBLIC_AVATAR_URL ?? "";
const AVATAR_DISABLED = AVATAR_OVERRIDE.toLowerCase() === "off";
const POLL_MS = 1500;
const AGENT_STATE_ATTRIBUTE = "lk.agent.state";
const AGENT_JOIN_TIMEOUT_MS = 15_000;
const MIC_SILENCE_WARNING_MS = 6_000;
const MIC_DEVICE_STORAGE_KEY = "trailgrad.preferredMicrophone";
const TYPED_ANSWER_TOPIC = "trailgrad.typed-answer";

interface DsaWorkspaceQuestion {
  title: string;
  primaryPattern: string;
  difficulty: string;
  expectedTimeMinutes: number;
  problemStatement?: string | null;
  promptSummary: string;
  examples?: Array<{ input: string; output: string; explanation?: string }>;
  constraints?: string[];
}

function turnKey(turn: Turn): string {
  return `${turn.speaker}-${turn.startMs}-${turn.endMs}-${turn.text}`;
}

function stopMediaStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function VoiceInterviewClient({
  workspaceAccent,
  resume,
  teacherId
}: {
  workspaceAccent: WorkspaceAccent;
  /** Backs the resume round's document preview. Null for other rounds. */
  resume?: CandidateResume | null;
  /** Persisted onboarding selection; legacy profiles fall back deterministically. */
  teacherId?: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params?.get("session") ?? null;
  const persona = useMemo(
    () => personaById(teacherId) ?? personaForSession(sessionId),
    [sessionId, teacherId]
  );

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
  const [planStages, setPlanStages] = useState<Array<InterviewStage | null>>([]);
  const [answeredConcept, setAnsweredConcept] = useState<InterviewConcept | null>(null);
  const [hardCapMs, setHardCapMs] = useState(DEFAULT_HARD_CAP_MS);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
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
  const [mediaSetupComplete, setMediaSetupComplete] = useState(false);
  const [candidateCameraStream, setCandidateCameraStream] = useState<MediaStream | null>(null);

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
  const dsaSkipPendingRef = useRef(false);
  const candidateCameraStreamRef = useRef<MediaStream | null>(null);
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const elapsed = useInterviewClock({
    startedAt,
    disabled: sessionUnavailable || status === "ended" || status === "error",
    hardCapMs
  });
  const dsaQuestionSlug = setup?.dsaQuestionSlugs?.[progress.index] ?? null;

  const replaceCandidateCameraStream = useCallback((stream: MediaStream | null) => {
    const previous = candidateCameraStreamRef.current;
    candidateCameraStreamRef.current = stream;
    setCandidateCameraStream(stream);
    if (previous && previous !== stream) stopMediaStream(previous);
  }, []);

  const disableCandidateCamera = useCallback(() => {
    replaceCandidateCameraStream(null);
  }, [replaceCandidateCameraStream]);

  const completeMediaSetup = useCallback(
    ({ cameraStream, microphoneDeviceId }: MediaSetupResult) => {
      if (microphoneDeviceId) {
        window.localStorage.setItem(MIC_DEVICE_STORAGE_KEY, microphoneDeviceId);
      }
      replaceCandidateCameraStream(cameraStream);
      setStatus("connecting");
      setMediaSetupComplete(true);
    },
    [replaceCandidateCameraStream]
  );

  useEffect(
    () => () => {
      stopMediaStream(candidateCameraStreamRef.current);
      candidateCameraStreamRef.current = null;
    },
    []
  );

  useEffect(() => {
    if (status !== "ended" && !sessionUnavailable) return;
    replaceCandidateCameraStream(null);
  }, [replaceCandidateCameraStream, sessionUnavailable, status]);

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
          : sessionChecked && !mediaSetupComplete
            ? "Interview Setup"
            : status === "error"
              ? "Interview Error"
              : "Connecting Interview";
    document.title = pageTitle(title);
  }, [mediaSetupComplete, phase, sessionChecked, status]);

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
    if (!sessionChecked || !mediaSetupComplete || sessionUnavailable || sessionCompleteRef.current)
      return;

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
          body: JSON.stringify({ sessionId, teacherId: persona.id })
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
  }, [
    connectionAttempt,
    mediaSetupComplete,
    router,
    sessionChecked,
    sessionId,
    sessionUnavailable,
    persona.id
  ]);

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
      setPlanStages(session.stages ?? []);
      setAnsweredConcept(session.answeredConcept ?? null);
      setHardCapMs(session.hardCapMs ?? DEFAULT_HARD_CAP_MS);
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
    if (
      setup?.templateTitle === "DSA practice interview" ||
      setup?.dsaBlockAssessment?.kind === "dsa-block-assessment"
    ) {
      setTypedStartedAt(Date.now());
      return;
    }
    if (setup?.resumeRound || setup?.fundamentalsRound) {
      // The middle panel is always open in a staged round, and the next
      // question supplies its own surface, so only the answer itself clears.
      setTypedDraft("");
      setTypedNotes("");
      setTypedStartedAt(Date.now());
      return;
    }
    setAnswerPanelOpen(false);
    setTypedDraft("");
    setTypedNotes("");
    setTypedStartedAt(null);
  }, [setup?.fundamentalsRound, setup?.resumeRound, setup?.templateTitle, turns, typedSending]);

  useEffect(() => {
    if (!setup?.resumeRound && !setup?.fundamentalsRound) return;

    setSelectedOption(null);
    setTypedError(null);
    setDsaRunResult(null);
    setTypedNotes("");
    setTypedDraft(currentQuestion?.stage === "code" ? (currentQuestion.codeSnippet ?? "") : "");
    setTypedStartedAt(Date.now());
    // Keyed on the question index so a follow-up on the same question keeps
    // whatever the candidate has already written.
  }, [progress.index, setup?.fundamentalsRound, setup?.resumeRound]);

  useEffect(() => {
    if (setup?.dsaBlockAssessment?.kind !== "dsa-block-assessment") return;
    // Assessment questions are a strict sequence. Do not carry a previous
    // answer, language output, or explanation into the next frozen prompt.
    setSelectedOption(null);
    setTypedError(null);
    setDsaRunResult(null);
    setTypedNotes("");
    setTypedDraft(
      currentQuestion?.kind === "code"
        ? (currentQuestion.dsaTransferQuestion?.starterCode?.[dsaLanguage] ?? "")
        : ""
    );
    setTypedStartedAt(Date.now());
    dsaSkipPendingRef.current = false;
  }, [
    currentQuestion?.dsaTransferQuestion?.slug,
    currentQuestion?.dsaTransferQuestion?.starterCode?.[dsaLanguage],
    currentQuestion?.kind,
    dsaLanguage,
    progress.index,
    setup?.dsaBlockAssessment?.kind
  ]);

  useEffect(() => {
    if (setup?.templateTitle !== "DSA practice interview" || !dsaQuestionSlug) return;
    const question = findQuestion(dsaQuestionSlug)?.question;
    setTypedDraft(question ? dsaStarterCode(question, dsaLanguage) : "");
    setTypedNotes("");
    setTypedError(null);
    setDsaRunResult(null);
    setTypedStartedAt(Date.now());
  }, [dsaLanguage, dsaQuestionSlug, setup?.templateTitle]);

  useEffect(() => {
    if (setup?.templateTitle === "DSA practice interview") return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [liveTranscript, setup?.templateTitle, turns]);

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
        new TextEncoder().encode(
          JSON.stringify({ text: answer, startMs, endMs, turnId: crypto.randomUUID() })
        ),
        { reliable: true, topic: TYPED_ANSWER_TOPIC }
      );
    } catch (caught) {
      setTypedSending(false);
      setTypedError(
        caught instanceof Error ? caught.message : "The typed answer could not be sent."
      );
    }
  }

  /**
   * A multiple choice answer travels the same path as a typed one. The server
   * recognises the question kind and scores it by comparison, so this costs no
   * model call and still lands in the transcript as something the candidate said.
   */
  async function submitOptionAnswer(option: string) {
    const room = roomRef.current;
    if (!room || !sessionId || !startedAt || typedSending || selectedOption) return;

    const now = Date.now();
    const startMs = Math.max(0, (typedStartedAt ?? now) - startedAt);
    const endMs = Math.max(startMs, now - startedAt);
    typedUserTurnsRef.current = turns.filter((turn) => turn.speaker === "user").length;
    setSelectedOption(option);
    setTypedSending(true);
    setTypedError(null);

    try {
      await room.localParticipant.publishData(
        new TextEncoder().encode(
          JSON.stringify({ text: option, startMs, endMs, turnId: crypto.randomUUID() })
        ),
        { reliable: true, topic: TYPED_ANSWER_TOPIC }
      );
    } catch (caught) {
      setSelectedOption(null);
      setTypedSending(false);
      setTypedError(caught instanceof Error ? caught.message : "That answer could not be sent.");
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
        new TextEncoder().encode(
          JSON.stringify({ text: answer, startMs, endMs, turnId: crypto.randomUUID() })
        ),
        { reliable: true, topic: TYPED_ANSWER_TOPIC }
      );
    } catch (caught) {
      setTypedSending(false);
      setTypedError(caught instanceof Error ? caught.message : "The solution could not be sent.");
    }
  }

  async function skipDsaCode() {
    if (
      !sessionId ||
      !startedAt ||
      typedSending ||
      dsaSkipPendingRef.current ||
      setup?.dsaBlockAssessment?.kind !== "dsa-block-assessment" ||
      currentQuestion?.kind !== "code"
    ) {
      return;
    }

    const now = Date.now();
    dsaSkipPendingRef.current = true;
    setTypedSending(true);
    setTypedError(null);
    try {
      await skipDsaBlockAssessmentCode({
        sessionId,
        startMs: Math.max(0, (typedStartedAt ?? now) - startedAt),
        endMs: Math.max(0, now - startedAt)
      });
      await poll();
    } catch (caught) {
      dsaSkipPendingRef.current = false;
      setTypedSending(false);
      setTypedError(caught instanceof Error ? caught.message : "The problem could not be skipped.");
    }
  }

  /**
   * The resume round's task is written for this candidate, so there are no
   * stored test cases. The code is run as-is and its output reported back.
   */
  async function runResumeCode() {
    const code = typedDraft.trim();
    if (!code || dsaRunning || !sessionId) return;

    setDsaRunning(true);
    setDsaRunResult(null);
    setTypedError(null);
    try {
      const response = await fetch("/api/code/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: typedDraft,
          language: resumeEditorLanguage(currentQuestion?.language ?? null),
          stdin: "",
          sessionId,
          questionIndex: progress.index
        })
      });
      const payload = (await response.json()) as {
        success?: boolean;
        data?: DsaRunResult;
        error?: { message?: string };
      };
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message || "The code runner could not run this.");
      }
      setDsaRunResult(payload.data);
    } catch (caught) {
      setTypedError(caught instanceof Error ? caught.message : "Code execution failed.");
    } finally {
      setDsaRunning(false);
    }
  }

  async function runDsaCode() {
    const frozenAssessment = setup?.dsaBlockAssessment?.kind === "dsa-block-assessment";
    if (!typedDraft.trim() || (!dsaQuestionSlug && !frozenAssessment) || dsaRunning || !sessionId)
      return;
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
          // Assessment runs deliberately omit a slug. The server resolves the
          // active transfer problem through the owned frozen snapshot.
          ...(frozenAssessment ? {} : { slug: dsaQuestionSlug }),
          stdin: "",
          sessionId,
          questionIndex: progress.index
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

    const blockId = setup?.dsaBlockAssessment?.blockId;
    if (blockId) {
      // Leaving never submits a partial block assessment. The same frozen
      // session stays resumable until every prompt is answered or skipped.
      intentionalDisconnectRef.current = true;
      await roomRef.current?.disconnect().catch(() => null);
      router.push(`/practice/dsa?block=${encodeURIComponent(blockId)}`);
      return;
    }

    sessionCompleteRef.current = true;
    setError(null);
    setStatus("ended");
    await endInterview(sessionId).catch(() => null);
    intentionalDisconnectRef.current = true;
    await roomRef.current?.disconnect();
  }, [router, sessionId, setup?.dsaBlockAssessment?.blockId]);

  useEffect(() => {
    if (elapsed < hardCapMs || status === "ended" || sessionUnavailable) return;
    if (setup?.dsaBlockAssessment?.kind === "dsa-block-assessment") return;
    void stop();
  }, [elapsed, sessionUnavailable, setup?.dsaBlockAssessment?.kind, status, stop]);

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

  const overCap = elapsed >= hardCapMs;
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

  // Four layouts render the interviewer; a function keeps them from drifting.
  const interviewerSlot = () =>
    AVATAR_DISABLED ? (
      <InterviewerPresence agentTrack={agentTrack} localTrack={localTrack} state={presence} />
    ) : (
      <AvatarStage
        agentTrack={agentTrack}
        state={presence}
        url={AVATAR_OVERRIDE || persona.model}
        rig={persona.rig}
      />
    );
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
  const isBlockAssessment = setup?.dsaBlockAssessment?.kind === "dsa-block-assessment";
  const isResumeRound = setup?.resumeRound === true;
  const isFundamentalsRound = setup?.fundamentalsRound === true;

  const stageProgress = stageCounts(planStages, progress.index);
  // Maya's reply to a graded answer carries the verdict, so the panel can mark
  // the chosen option without a second request.
  const lastGrade = (() => {
    for (let index = turns.length - 1; index >= 0; index -= 1) {
      const turn = turns[index];
      if (turn?.speaker === "agent" && typeof turn.correct === "boolean") {
        return { questionIndex: turn.gradedQuestionIndex ?? -1, correct: turn.correct };
      }
    }
    return null;
  })();
  const normalizedTemplateTitle = setup?.templateTitle?.toLowerCase() ?? "";
  const isBehavioralInterview =
    setup?.roundType === "behavioral" ||
    normalizedTemplateTitle.includes("resume") ||
    normalizedTemplateTitle.includes("behavioral");
  const selectedDsaSlug = setup?.dsaQuestionSlugs?.[progress.index];
  const dsaQuestion =
    isDsaInterview && selectedDsaSlug ? (findQuestion(selectedDsaSlug)?.question ?? null) : null;
  const frozenTransferQuestion =
    isBlockAssessment && currentQuestion?.kind === "code"
      ? (currentQuestion.dsaTransferQuestion ?? null)
      : null;
  const activeDsaQuestion: DsaWorkspaceQuestion | null = dsaQuestion ?? frozenTransferQuestion;

  if (sessionUnavailable) {
    return <SessionStateScreen kind="expired" workspaceAccent={workspaceAccent} />;
  }

  if (!sessionChecked) {
    return (
      <SessionLoadingScreen
        workspaceAccent={workspaceAccent}
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
        workspaceAccent={workspaceAccent}
        kind="complete"
        duration={Math.min(elapsed, hardCapMs)}
        answers={turns.filter((turn) => turn.speaker === "user").length}
        blockAssessmentBlockId={setup?.dsaBlockAssessment?.blockId ?? null}
      />
    );
  }

  if (!mediaSetupComplete) {
    return (
      <VoiceShell workspaceAccent={workspaceAccent} wide>
        <MediaPermissionGate cameraOptional onComplete={completeMediaSetup} />
      </VoiceShell>
    );
  }

  return (
    <VoiceShell workspaceAccent={workspaceAccent} wide>
      <audio ref={audioRef} autoPlay />

      <header className="mb-3 flex shrink-0 flex-col gap-2 rounded-2xl border border-white/[0.08] bg-[rgba(25,26,29,0.58)] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_14px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:min-h-14 sm:flex-row sm:items-center sm:gap-3 sm:px-4">
        <div className="thin-scroll w-full min-w-0 overflow-x-auto py-1 sm:flex-1">
          <PathRail
            phase={phase}
            questionIndex={progress.index}
            questionCount={progress.count}
            followUpCount={progress.followUps}
            maxFollowUps={currentQuestion?.maxFollowUps ?? 2}
          />
        </div>

        <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:ml-auto sm:w-auto">
          <button
            type="button"
            onClick={() => void toggleMic()}
            disabled={!micAvailable}
            className={`inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition disabled:opacity-30 ${
              micOn
                ? "bg-white/[0.06] text-cream hover:bg-white/[0.09]"
                : "bg-[color-mix(in_srgb,var(--workspace-accent)_12%,transparent)] text-[var(--workspace-accent)] hover:bg-[color-mix(in_srgb,var(--workspace-accent)_17%,transparent)]"
            }`}
            aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
            title={micOn ? "Mute microphone" : "Unmute microphone"}
          >
            {micOn ? <Mic size={14} aria-hidden="true" /> : <MicOff size={14} aria-hidden="true" />}
            <span className="hidden xl:inline">
              {micOn && micSignal && status === "live" ? "Mic ready" : statusLabel}
            </span>
          </button>

          <div className="hidden w-40 xl:block">
            <MicrophonePicker
              devices={audioInputs}
              selectedId={selectedInputId}
              disabled={!micAvailable || switchingMic}
              onChange={(deviceId) => void switchMicrophone(deviceId)}
            />
          </div>

          <span
            className={`rounded-xl bg-black/20 px-3 py-2.5 font-mono text-sm tabular-nums ${
              overCap ? "text-[var(--workspace-accent)]" : "text-cream/72"
            }`}
          >
            {formatClock(Math.min(elapsed, hardCapMs))}
            <span className="hidden text-cream/28 sm:inline"> / {formatClock(hardCapMs)}</span>
          </span>
          <button
            type="button"
            onClick={() => void stop()}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.045] px-3 text-sm font-semibold text-cream/65 transition hover:bg-white/[0.08] hover:text-cream"
          >
            <Square size={11} aria-hidden="true" />
            <span className="hidden sm:inline">{isBlockAssessment ? "Save & exit" : "End"}</span>
          </button>
        </div>
      </header>

      {isFundamentalsRound ? (
        <FundamentalsLiveWorkspace
          question={currentQuestion}
          questionIndex={progress.index}
          questionCount={progress.count}
          counts={stageProgress}
          grade={lastGrade}
          concept={answeredConcept}
          turns={displayTurns}
          spokenAgentTurnKeys={spokenAgentTurnKeys}
          liveUserText={liveTranscript}
          startedAt={startedAt}
          setup={setup}
          thinking={agentState === "thinking"}
          bottomRef={bottomRef}
          agentSlot={interviewerSlot()}
          micOn={micOn}
          sending={typedSending}
          error={typedError}
          draft={typedDraft}
          selectedOption={selectedOption}
          onDraftChange={setTypedDraft}
          onSelectOption={(option) => void submitOptionAnswer(option)}
          onSubmit={() => void submitTypedAnswer()}
          onRequestMic={() => void toggleMic()}
          candidateCameraStream={candidateCameraStream}
          onDisableCamera={disableCandidateCamera}
        />
      ) : isBlockAssessment && currentQuestion?.kind === "mcq" ? (
        <BlockAssessmentReviewWorkspace
          question={currentQuestion}
          questionIndex={progress.index}
          questionCount={progress.count}
          counts={stageProgress}
          grade={lastGrade}
          turns={displayTurns}
          spokenAgentTurnKeys={spokenAgentTurnKeys}
          liveUserText={liveTranscript}
          startedAt={startedAt}
          setup={setup}
          thinking={agentState === "thinking"}
          bottomRef={bottomRef}
          agentSlot={interviewerSlot()}
          micOn={micOn}
          sending={typedSending}
          error={typedError}
          draft={typedDraft}
          selectedOption={selectedOption}
          onDraftChange={setTypedDraft}
          onSelectOption={(option) => void submitOptionAnswer(option)}
          onSubmit={() => void submitTypedAnswer()}
          onRequestMic={() => void toggleMic()}
          candidateCameraStream={candidateCameraStream}
          onDisableCamera={disableCandidateCamera}
        />
      ) : isResumeRound ? (
        <ResumeLiveWorkspace
          resume={resume ?? null}
          question={currentQuestion}
          questionIndex={progress.index}
          questionCount={progress.count}
          counts={stageProgress}
          grade={lastGrade}
          turns={displayTurns}
          spokenAgentTurnKeys={spokenAgentTurnKeys}
          liveUserText={liveTranscript}
          startedAt={startedAt}
          setup={setup}
          thinking={agentState === "thinking"}
          bottomRef={bottomRef}
          agentSlot={interviewerSlot()}
          micOn={micOn}
          language={resumeEditorLanguage(currentQuestion?.language ?? null)}
          sending={typedSending}
          error={typedError}
          draft={typedDraft}
          notes={typedNotes}
          selectedOption={selectedOption}
          running={dsaRunning}
          onDraftChange={setTypedDraft}
          onNotesChange={setTypedNotes}
          onSelectOption={(option) => void submitOptionAnswer(option)}
          onSubmit={() => void submitTypedAnswer()}
          onRun={() => void runResumeCode()}
          onRequestMic={() => void toggleMic()}
          candidateCameraStream={candidateCameraStream}
          onDisableCamera={disableCandidateCamera}
        />
      ) : isDsaInterview || (isBlockAssessment && currentQuestion?.kind === "code") ? (
        <DsaLiveWorkspace
          question={activeDsaQuestion}
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
          renderInterviewer={interviewerSlot}
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
          onSkip={isBlockAssessment ? () => void skipDsaCode() : undefined}
          candidateCameraStream={candidateCameraStream}
          onDisableCamera={disableCandidateCamera}
        />
      ) : (
        <div
          className={`thin-scroll min-h-0 flex-1 gap-3 overflow-y-auto pb-4 ${
            answerPanelOpen ? "hidden lg:grid" : "grid"
          } xl:grid-cols-[minmax(0,1fr)_20rem] xl:overflow-hidden xl:pb-0`}
        >
          <section
            className={`${INTERVIEW_PANEL_SHELL} order-2 flex min-h-[34rem] min-w-0 flex-col overflow-hidden xl:order-1 xl:min-h-0`}
          >
            <div
              className={`flex shrink-0 items-center justify-between gap-4 border-b ${INTERVIEW_PANEL_RULE} px-5 py-4 sm:px-6`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-[var(--workspace-accent)] shadow-[0_0_14px_var(--workspace-accent)]" />
                <div className="min-w-0">
                  <h1 className="truncate text-base font-semibold text-cream">
                    {isBehavioralInterview ? "Resume conversation" : "Interview conversation"}
                  </h1>
                  {isBehavioralInterview ? (
                    <p className="mt-0.5 truncate text-sm text-cream/45">
                      Evidence, ownership and decisions from your experience
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-sm text-cream/48">
                <span className="hidden sm:inline">
                  Question {Math.min(progress.index + 1, progress.count)} of {progress.count}
                </span>
                <span className="hidden h-1 w-1 rounded-full bg-cream/24 sm:block" />
                <span>{statusLabel}</span>
              </div>
            </div>

            <div className="thin-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-7">
              {status === "connecting" || status === "waiting" || status === "reconnecting" ? (
                <p className="flex items-center gap-2.5 text-sm text-cream/48">
                  <Loader2
                    size={15}
                    className="animate-spin text-[var(--workspace-accent)]"
                    aria-hidden="true"
                  />
                  {status === "waiting"
                    ? `${persona.name} is joining the room`
                    : status === "reconnecting"
                      ? "Restoring your conversation"
                      : "Connecting your interview"}
                </p>
              ) : null}

              {error ? (
                <div className="rounded-xl border border-[color-mix(in_srgb,var(--workspace-accent)_18%,transparent)] bg-[color-mix(in_srgb,var(--workspace-accent)_7%,transparent)] px-4 py-3">
                  <p className="text-sm leading-6 text-cream">{error}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {!sessionUnavailable ? (
                      <button
                        type="button"
                        onClick={() => void reconnect()}
                        className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-white/[0.06] px-3 text-sm font-semibold text-cream transition hover:bg-white/10"
                      >
                        <RefreshCw size={14} aria-hidden="true" />
                        Reconnect
                      </button>
                    ) : null}
                    <Link
                      href="/interview?resume=1"
                      className="text-sm text-cream/62 hover:text-cream"
                    >
                      Start over
                    </Link>
                  </div>
                </div>
              ) : null}

              {playbackBlocked ? (
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-4 py-3">
                  <p className="text-sm leading-6 text-cream/78">
                    Your browser paused call audio. Enable it once and the conversation will
                    continue.
                  </p>
                  <button
                    type="button"
                    onClick={() => audioRetryRef.current?.()}
                    className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-lg bg-white/[0.06] px-3 text-sm font-semibold text-cream transition hover:bg-white/10"
                  >
                    <Volume2 size={14} aria-hidden="true" />
                    Enable audio
                  </button>
                </div>
              ) : null}

              {micError ? (
                <div className="rounded-xl border border-[color-mix(in_srgb,var(--workspace-accent)_18%,transparent)] bg-[color-mix(in_srgb,var(--workspace-accent)_7%,transparent)] px-4 py-3">
                  <p className="text-sm leading-6 text-cream/78">{micError}</p>
                  <button
                    type="button"
                    onClick={() => micRetryRef.current?.()}
                    className="mt-2 inline-flex min-h-9 items-center rounded-lg bg-white/[0.06] px-3 text-sm font-semibold text-cream transition hover:bg-white/10"
                  >
                    Retry microphone
                  </button>
                </div>
              ) : null}

              {micSilent && !micError ? (
                <div className="rounded-xl border border-[color-mix(in_srgb,var(--workspace-accent)_18%,transparent)] bg-[color-mix(in_srgb,var(--workspace-accent)_7%,transparent)] px-4 py-3">
                  <p className="text-sm font-medium text-cream">No microphone signal detected</p>
                  <p className="mt-1 text-sm leading-6 text-cream/58">
                    The room is connected to {selectedInputLabel}, but no audible sound is arriving.
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
                hideHeader
              />
            </div>

            <div
              className={`flex shrink-0 flex-col gap-3 border-t ${INTERVIEW_PANEL_RULE} bg-black/10 px-4 py-3 sm:flex-row sm:items-center`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <button
                  type="button"
                  onClick={() => void toggleMic()}
                  disabled={!micAvailable}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition disabled:opacity-30 ${
                    micOn
                      ? "bg-cream text-blueprint"
                      : "bg-[color-mix(in_srgb,var(--workspace-accent)_12%,transparent)] text-[var(--workspace-accent)]"
                  }`}
                  aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
                >
                  {micOn ? (
                    <Mic size={17} aria-hidden="true" />
                  ) : (
                    <MicOff size={17} aria-hidden="true" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-cream">
                    {micOn && micSignal && status === "live"
                      ? `${persona.name} can hear you`
                      : statusLabel}
                  </p>
                  <div className="mt-1.5 max-w-52">
                    <MicMeter
                      track={localTrack}
                      muted={!micOn || !micAvailable}
                      onSignalChange={handleMicSignalChange}
                    />
                  </div>
                </div>
              </div>

              <div className="flex min-w-0 shrink-0 items-center gap-2">
                <div className="hidden w-44 sm:block">
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
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/[0.055] px-3.5 text-sm font-semibold text-cream/72 transition hover:bg-white/[0.09] hover:text-cream disabled:opacity-30"
                >
                  <Keyboard size={15} aria-hidden="true" />
                  <span>{currentQuestion?.kind === "code" ? "Write solution" : "Type answer"}</span>
                </button>
              </div>
            </div>
          </section>

          <aside className="workspace-accent-card-glow order-1 flex min-h-[20rem] flex-col overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--workspace-accent)_26%,transparent)] bg-[color-mix(in_srgb,var(--workspace-accent)_4%,rgba(17,18,21,0.68))] shadow-[inset_0_1px_0_rgba(255,255,255,0.045),0_24px_70px_rgba(0,0,0,0.24)] backdrop-blur-2xl xl:order-2 xl:min-h-0">
            <div className="relative min-h-64 flex-1 overflow-hidden">
              <div className="pointer-events-none absolute inset-3 flex items-center justify-center">
                <div className="h-full max-h-[29rem] w-full max-w-[21rem]">{interviewerSlot()}</div>
              </div>

              <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full border border-white/[0.08] bg-black/55 px-3 py-1.5 backdrop-blur-lg">
                <span
                  className={`h-2 w-2 rounded-full ${
                    status === "live"
                      ? "bg-[var(--workspace-accent)] shadow-[0_0_12px_var(--workspace-accent)]"
                      : "animate-pulse bg-cream/45"
                  }`}
                />
                <span className="text-sm font-medium text-cream">{persona.name}</span>
              </div>
            </div>

            {candidateCameraStream ? (
              <CandidateCameraPreview
                stream={candidateCameraStream}
                onDisable={disableCandidateCamera}
              />
            ) : null}
          </aside>
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
  renderInterviewer,
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
  onSubmit,
  onSkip,
  candidateCameraStream,
  onDisableCamera
}: {
  question: DsaWorkspaceQuestion | null;
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
  /** Built by the parent so every layout shows the same interviewer. */
  renderInterviewer: () => React.ReactNode;
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
  onSkip?: () => void;
  candidateCameraStream: MediaStream | null;
  onDisableCamera: () => void;
}) {
  const teacher = useWorkspaceTeacher();
  const canSubmit = draft.trim().length >= 10 && !sending;
  const splitWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const [questionPaneWidth, setQuestionPaneWidth] = useState(38);
  const [expandedPane, setExpandedPane] = useState<"question" | "editor" | null>(null);
  const [skipConfirmationVisible, setSkipConfirmationVisible] = useState(false);

  const beginPaneResize = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const workspace = splitWorkspaceRef.current;
    if (!workspace) return;

    event.preventDefault();
    setExpandedPane(null);
    const bounds = workspace.getBoundingClientRect();
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    const updateWidth = (pointerEvent: PointerEvent) => {
      const nextWidth = ((pointerEvent.clientX - bounds.left) / bounds.width) * 100;
      setQuestionPaneWidth(Math.min(58, Math.max(28, nextWidth)));
    };
    const stopResize = () => {
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", updateWidth);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
    };

    updateWidth(event.nativeEvent);
    window.addEventListener("pointermove", updateWidth);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
  }, []);

  return (
    <div className="thin-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-4 xl:grid xl:grid-cols-[minmax(0,1fr)_19rem] xl:overflow-hidden xl:pb-0">
      <div
        ref={splitWorkspaceRef}
        style={
          {
            "--question-pane-size": `${expandedPane === "editor" ? 0 : expandedPane === "question" ? 100 : questionPaneWidth}fr`,
            "--editor-pane-size": `${expandedPane === "question" ? 0 : expandedPane === "editor" ? 100 : 100 - questionPaneWidth}fr`,
            "--pane-divider-size": expandedPane ? "0rem" : "0.75rem"
          } as React.CSSProperties
        }
        className="grid shrink-0 gap-3 transition-[grid-template-columns] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none xl:min-h-0 xl:shrink xl:grid-cols-[minmax(0,var(--question-pane-size))_var(--pane-divider-size)_minmax(0,var(--editor-pane-size))] xl:gap-0"
      >
        <section
          className={`${INTERVIEW_PANEL_SHELL} thin-scroll min-h-[24rem] min-w-0 max-h-[38rem] overflow-y-auto transition-[opacity,transform] duration-300 motion-reduce:transition-none xl:max-h-none xl:min-h-0 ${
            expandedPane === "editor"
              ? "xl:pointer-events-none xl:translate-x-2 xl:opacity-0"
              : "xl:translate-x-0 xl:opacity-100"
          }`}
        >
          {question ? (
            <div className="px-5 pb-7 sm:px-7 sm:pb-8">
              <div
                className={`sticky top-0 z-10 -mx-5 flex items-center justify-between gap-3 border-b ${INTERVIEW_PANEL_RULE} bg-[rgba(17,18,21,0.92)] px-5 py-4 text-sm backdrop-blur-2xl sm:-mx-7 sm:px-7`}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--workspace-accent)] shadow-[0_0_10px_var(--workspace-accent)]" />
                  <span className="whitespace-nowrap font-medium text-cream/72">
                    Problem {questionIndex + 1} of {questionCount}
                  </span>
                  <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-cream/24" />
                  <span className="truncate capitalize text-cream/44">{question.difficulty}</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedPane((current) => (current === "question" ? null : "question"))
                  }
                  className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg text-cream/46 transition hover:bg-white/[0.06] hover:text-cream xl:inline-flex"
                  aria-label={
                    expandedPane === "question" ? "Restore question pane" : "Expand question pane"
                  }
                  title={expandedPane === "question" ? "Restore split view" : "Expand question"}
                >
                  {expandedPane === "question" ? (
                    <Minimize2 size={15} aria-hidden="true" />
                  ) : (
                    <Maximize2 size={15} aria-hidden="true" />
                  )}
                </button>
              </div>

              <h1 className="mt-6 text-balance font-display text-[1.8rem] font-semibold leading-[1.14] tracking-tight text-cream sm:text-[2rem]">
                {question.title}
              </h1>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                <DsaMetaPill>{question.primaryPattern.replace(/-/g, " ")}</DsaMetaPill>
                <DsaMetaPill>{question.expectedTimeMinutes} min</DsaMetaPill>
              </div>

              <DsaCopySection title="Description">
                <p>{question.problemStatement ?? question.promptSummary}</p>
              </DsaCopySection>

              {question.examples?.length ? (
                <DsaCopySection title="Examples">
                  <div className="space-y-3">
                    {question.examples.map((example, index) => (
                      <article
                        key={`${example.input}-${example.output}`}
                        className="rounded-xl bg-white/[0.03] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] sm:p-5"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            aria-hidden="true"
                            className="h-1.5 w-1.5 rounded-full bg-[var(--workspace-accent)] shadow-[0_0_9px_var(--workspace-accent)]"
                          />
                          <p className="text-sm font-semibold text-cream/78">Example {index + 1}</p>
                        </div>
                        <dl className="mt-4 grid gap-3 text-sm leading-6">
                          <div className="grid gap-1.5 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
                            <dt className="font-medium text-cream/42">Input</dt>
                            <dd className="thin-scroll overflow-x-auto whitespace-pre rounded-lg bg-black/20 px-3 py-2 font-mono text-cream/72">
                              {example.input}
                            </dd>
                          </div>
                          <div className="grid gap-1.5 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
                            <dt className="font-medium text-cream/42">Output</dt>
                            <dd className="thin-scroll overflow-x-auto whitespace-pre rounded-lg bg-black/20 px-3 py-2 font-mono text-cream/72">
                              {example.output}
                            </dd>
                          </div>
                        </dl>
                        {example.explanation ? (
                          <p className="mt-4 text-sm leading-6 text-cream/56">
                            {example.explanation}
                          </p>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </DsaCopySection>
              ) : null}
              {question.constraints?.length ? (
                <DsaCopySection title="Constraints">
                  <ul className="space-y-3 rounded-xl bg-white/[0.03] p-4 font-mono text-sm leading-6 text-cream/68 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] sm:p-5">
                    {question.constraints.map((constraint) => (
                      <li key={constraint} className="flex gap-3">
                        <span
                          aria-hidden="true"
                          className="mt-[0.62rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--workspace-accent)] shadow-[0_0_9px_var(--workspace-accent)]"
                        />
                        <code>{constraint}</code>
                      </li>
                    ))}
                  </ul>
                </DsaCopySection>
              ) : null}
              {questionSlug ? <DsaQuestionNotes slug={questionSlug} /> : null}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center">
              <p className="text-sm leading-6 text-cream/50">
                {teacher.name} is preparing the next problem.
              </p>
            </div>
          )}
        </section>

        <button
          type="button"
          onPointerDown={beginPaneResize}
          onDoubleClick={() => setQuestionPaneWidth(38)}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home") {
              return;
            }
            event.preventDefault();
            setExpandedPane(null);
            setQuestionPaneWidth((current) => {
              if (event.key === "Home") return 38;
              const change = event.key === "ArrowLeft" ? -2 : 2;
              return Math.min(58, Math.max(28, current + change));
            });
          }}
          className={`group relative hidden cursor-col-resize touch-none items-center justify-center overflow-hidden text-cream/24 outline-none transition-[opacity,color] duration-300 hover:text-[var(--workspace-accent)] focus-visible:text-[var(--workspace-accent)] xl:flex ${
            expandedPane ? "xl:pointer-events-none xl:opacity-0" : "xl:opacity-100"
          }`}
          aria-label="Resize question and solution panes"
          role="separator"
          aria-orientation="vertical"
          aria-valuemin={28}
          aria-valuemax={58}
          aria-valuenow={Math.round(questionPaneWidth)}
          title="Drag to resize · Double-click to reset"
        >
          <span className="absolute inset-y-6 left-1/2 w-px -translate-x-1/2 bg-white/[0.04] transition group-hover:bg-[var(--workspace-accent)]/30" />
          <span className="relative flex h-10 w-5 items-center justify-center text-cream/24 transition group-hover:text-[var(--workspace-accent)]">
            <GripVertical size={13} aria-hidden="true" />
          </span>
        </button>

        <section
          className={`${INTERVIEW_PANEL_SHELL} flex h-[44rem] min-h-0 min-w-0 shrink-0 flex-col overflow-hidden transition-[opacity,transform] duration-300 motion-reduce:transition-none sm:h-[48rem] xl:h-auto xl:shrink ${
            expandedPane === "question"
              ? "xl:pointer-events-none xl:-translate-x-2 xl:opacity-0"
              : "xl:translate-x-0 xl:opacity-100"
          }`}
        >
          <div
            className={`flex min-h-16 shrink-0 flex-col items-stretch gap-3 border-b ${INTERVIEW_PANEL_RULE} px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-base font-semibold text-cream">
                <Code2 size={17} aria-hidden="true" className="text-[var(--workspace-accent)]" />
                Solution
              </div>
              <button
                type="button"
                onClick={() =>
                  setExpandedPane((current) => (current === "editor" ? null : "editor"))
                }
                className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg text-cream/46 transition hover:bg-white/[0.06] hover:text-cream xl:inline-flex"
                aria-label={
                  expandedPane === "editor" ? "Restore solution pane" : "Expand solution pane"
                }
                title={expandedPane === "editor" ? "Restore split view" : "Expand solution"}
              >
                {expandedPane === "editor" ? (
                  <Minimize2 size={15} aria-hidden="true" />
                ) : (
                  <Maximize2 size={15} aria-hidden="true" />
                )}
              </button>
            </div>
            <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:w-auto">
              <label className="sr-only" htmlFor="dsa-language">
                Language
              </label>
              <select
                id="dsa-language"
                value={language}
                onChange={(event) => onLanguageChange(event.target.value as DsaLanguage)}
                className="h-10 min-w-0 rounded-xl border-0 bg-white/[0.045] px-3 text-sm text-cream/75 outline-none ring-1 ring-inset ring-white/[0.045] transition focus:bg-white/[0.07] focus:ring-white/[0.11] sm:min-w-32"
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
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-cream px-4 text-sm font-semibold text-[#101113] transition hover:bg-white disabled:pointer-events-none disabled:opacity-35"
              >
                {running ? (
                  <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Play size={13} aria-hidden="true" />
                )}
                {running ? "Running" : "Run code"}
              </button>
            </div>
          </div>
          <div className="min-h-64 flex-1 overflow-hidden bg-[#0b0d10]">
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
          <div className={`shrink-0 border-t ${INTERVIEW_PANEL_RULE} bg-black/10 p-4 sm:p-5`}>
            <label htmlFor="dsa-approach" className="text-sm font-semibold text-cream/82">
              Explain your approach to {teacher.name}
              <span className="ml-2 hidden font-normal text-cream/38 xl:inline">
                Include the idea and complexity.
              </span>
            </label>
            <div className="mt-2.5 flex flex-col gap-2.5 sm:flex-row sm:items-end">
              <ResizableTextarea
                id="dsa-approach"
                value={notes}
                onChange={(event) => onNotesChange(event.target.value)}
                rows={2}
                placeholder="Why is this correct? What are the time and space costs?"
                minHeight={76}
                maxHeight={144}
                containerClassName="min-w-0 flex-1"
                textareaClassName="rounded-xl border-0 bg-black/20 px-3.5 py-2.5 font-sans text-sm leading-6 text-cream outline-none ring-1 ring-inset ring-white/[0.045] transition placeholder:text-cream/26 focus:bg-black/30 focus:ring-white/[0.1]"
              />
              <div className="flex shrink-0 flex-col gap-1.5 sm:items-end">
                <button
                  type="button"
                  onClick={() => {
                    setSkipConfirmationVisible(false);
                    onSubmit();
                  }}
                  disabled={!canSubmit}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cream px-5 text-sm font-semibold text-[#101113] transition hover:bg-white disabled:pointer-events-none disabled:opacity-35"
                >
                  {sending ? (
                    <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Send size={15} aria-hidden="true" />
                  )}
                  {sending ? `${teacher.name} is reviewing` : `Send solution to ${teacher.name}`}
                </button>
                {onSkip && !skipConfirmationVisible ? (
                  <button
                    type="button"
                    onClick={() => setSkipConfirmationVisible(true)}
                    disabled={sending}
                    className="min-h-9 px-2 text-sm font-semibold text-cream/48 transition hover:text-cream disabled:cursor-wait disabled:opacity-40"
                  >
                    I can&apos;t solve this
                  </button>
                ) : null}
              </div>
            </div>
            {onSkip && skipConfirmationVisible ? (
              <div
                role="alertdialog"
                aria-labelledby="skip-code-confirmation-title"
                aria-describedby="skip-code-confirmation-description"
                className="mt-3 flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-white/[0.035] p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p id="skip-code-confirmation-title" className="text-sm font-semibold text-cream">
                    Skip this coding question?
                  </p>
                  <p
                    id="skip-code-confirmation-description"
                    className="mt-0.5 text-sm leading-5 text-cream/52"
                  >
                    You will receive 0 points for this question. This cannot be undone.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSkipConfirmationVisible(false)}
                    disabled={sending}
                    className="min-h-10 rounded-lg px-3 text-sm font-semibold text-cream/62 transition hover:bg-white/[0.04] hover:text-cream"
                  >
                    Keep trying
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSkipConfirmationVisible(false);
                      onSkip();
                    }}
                    disabled={sending}
                    className="min-h-10 rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 text-sm font-semibold text-cream transition hover:bg-white/[0.1] disabled:cursor-wait disabled:opacity-40"
                  >
                    Yes, skip question
                  </button>
                </div>
              </div>
            ) : null}
            {error ? <p className="mt-2 text-sm text-[#ffb4b4]">{error}</p> : null}
          </div>
        </section>
      </div>

      <MayaAside
        agentSlot={renderInterviewer()}
        turns={turns}
        spokenAgentTurnKeys={spokenAgentTurnKeys}
        liveUserText={liveUserText}
        startedAt={startedAt}
        setup={setup}
        question={currentQuestion}
        thinking={thinking}
        bottomRef={bottomRef}
        candidateCameraStream={candidateCameraStream}
        onDisableCamera={onDisableCamera}
      />
    </div>
  );
}

function DsaOutputPanel({
  examples,
  result,
  running
}: {
  examples: NonNullable<DsaWorkspaceQuestion["examples"]>;
  result: DsaRunResult | null;
  running: boolean;
}) {
  const statusClass = result?.accepted ? "text-[var(--workspace-accent)]" : "text-[#ffb4b4]";

  return (
    <section
      className={`max-h-64 shrink-0 overflow-hidden border-t ${INTERVIEW_PANEL_RULE} bg-black/10`}
    >
      <div className="flex min-h-12 items-center justify-between gap-4 px-4 pb-2 pt-3.5">
        <div>
          <h3 className="text-sm font-semibold text-cream/86">Test results</h3>
          <p className="mt-0.5 text-sm text-cream/38">
            Check the supplied examples before submitting.
          </p>
        </div>
        {running ? (
          <span className="flex items-center gap-2 text-sm text-cream/58">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--workspace-accent)] shadow-[0_0_10px_var(--workspace-accent)]" />
            Running tests
          </span>
        ) : result ? (
          <span className={`inline-flex items-center gap-2 text-sm font-semibold ${statusClass}`}>
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                result.accepted
                  ? "bg-[var(--workspace-accent)] shadow-[0_0_10px_var(--workspace-accent)]"
                  : "bg-[#ff8f8f] shadow-[0_0_10px_#ff8f8f]"
              }`}
            />
            {result.status}
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 text-sm text-cream/48">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--workspace-accent)] shadow-[0_0_10px_var(--workspace-accent)]" />
            Ready to run
          </span>
        )}
      </div>
      <div className="thin-scroll max-h-48 overflow-y-auto px-4 pb-4 pt-1">
        {result?.compileOutput || result?.stderr ? (
          <pre className="rounded-xl bg-[#dd5f5f]/[0.045] p-4 whitespace-pre-wrap font-mono text-sm leading-6 text-[#ffb4b4] ring-1 ring-inset ring-[#dd5f5f]/10">
            {result.compileOutput || result.stderr}
          </pre>
        ) : result?.tests.length ? (
          <div className="space-y-2">
            {result.tests.map((test) => (
              <div key={test.index} className="rounded-xl bg-white/[0.03] p-3.5">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-semibold text-cream/78">Case {test.index + 1}</span>
                  <span
                    className={`text-sm font-semibold ${
                      test.passed ? "text-[var(--workspace-accent)]" : "text-[#ffb4b4]"
                    }`}
                  >
                    {test.passed ? "Passed" : "Failed"}
                  </span>
                </div>
                <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm leading-6 sm:grid-cols-[5rem_1fr]">
                  <dt className="font-medium text-cream/38">Input</dt>
                  <dd className="break-words font-mono text-cream/68">{test.input}</dd>
                  <dt className="font-medium text-cream/38">Expected</dt>
                  <dd className="break-words font-mono text-cream/68">{test.expectedOutput}</dd>
                  <dt className="font-medium text-cream/38">Your output</dt>
                  <dd className="break-words font-mono text-cream/68">
                    {test.error || test.actualOutput || "No output"}
                  </dd>
                </dl>
              </div>
            ))}
            {result.stdout ? (
              <div className="rounded-xl bg-white/[0.02] p-3.5">
                <p className="text-sm font-semibold text-cream/68">Console output</p>
                <pre className="mt-2 whitespace-pre-wrap font-mono text-sm leading-6 text-cream/58">
                  {result.stdout}
                </pre>
              </div>
            ) : null}
          </div>
        ) : examples.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {examples.slice(0, 10).map((example, index) => (
              <div key={`${example.input}-${index}`} className="rounded-xl bg-white/[0.03] p-3.5">
                <p className="text-sm font-semibold text-cream/72">Case {index + 1}</p>
                <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm leading-6 sm:grid-cols-[5rem_1fr]">
                  <dt className="font-medium text-cream/38">Input</dt>
                  <dd className="break-words font-mono text-cream/64">{example.input}</dd>
                  <dt className="font-medium text-cream/38">Expected</dt>
                  <dd className="break-words font-mono text-cream/64">{example.output}</dd>
                </dl>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl bg-white/[0.03] p-4 text-sm leading-6 text-cream/42">
            No runnable examples are available for this question yet.
          </p>
        )}
      </div>
    </section>
  );
}

function DsaCopySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="mb-4 text-base font-semibold text-cream/84">{title}</h2>
      <div className="text-[15px] leading-7 text-cream/68">{children}</div>
    </section>
  );
}

function DsaMetaPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm capitalize text-cream/52">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--workspace-accent)]" aria-hidden="true" />
      {children}
    </span>
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
