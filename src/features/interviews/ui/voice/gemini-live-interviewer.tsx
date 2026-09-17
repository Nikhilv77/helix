"use client";

import {
  ActivityHandling,
  AudioTranscriptionConfigMode,
  EndSensitivity,
  GoogleGenAI,
  Modality,
  StartSensitivity
} from "@google/genai";
import {
  LIVE_CANDIDATE_TURN_COMMIT_GRACE_MS,
  LIVE_END_OF_SPEECH_SILENCE_MS
} from "@/features/interviews/domain/voice-turn-timing";
import {
  COMPLETE_INTERVIEW_TURN_TOOL,
  GEMINI_LED_INTERVIEW_TOOLS
} from "@/features/interviews/domain/gemini-live-conversation";
import { forwardRef, useEffect, useImperativeHandle, useRef, type MutableRefObject } from "react";
import { submitAnswer } from "@/lib/api/api-client";
import type { AgentState, VoiceStatus } from "./types";

const INPUT_SAMPLE_RATE = 16_000;
const OUTPUT_SAMPLE_RATE = 24_000;
const TRANSCRIPTION_ROTATION_MS = 8 * 60 * 1000;
const TRANSCRIPTION_RETRY_MS = 15_000;
const DUPLICATE_TURN_WINDOW_MS = 2_500;
const APPROVED_AUDIO_FALLBACK_MS = 8_000;

type TranscriptionConnection = {
  token: string;
  model: string;
  vocabulary: string[];
  languageCodes: string[];
};

type LiveTokenResponse = {
  token: string;
  model: string;
  voiceName: string;
  systemInstruction: string;
  openingUtterance: string;
  sessionStartedAt: number;
  conversationMode: "gemini-led" | "server-led";
  transcription?: TranscriptionConnection;
};

type LiveSession = {
  close(): void;
  sendRealtimeInput(input: unknown): void;
  sendClientContent(input: unknown): void;
  sendToolResponse(input: unknown): void;
};

type TranscriptionChannel = {
  session: LiveSession;
  retire(): void;
};

type AuthoritativeResponse = {
  answer: string;
  utterance: string;
  action: LiveConversationProposal["action"];
  phase: string;
  questionIndex: number;
};

type LiveConversationProposal = {
  action: "clarify" | "probe" | "challenge" | "respond" | "move_on";
  missing: "clarity" | "structure" | "specificity" | "ownership" | "outcome" | "none";
  candidateIntent: "answer" | "decline" | "end" | "question-or-clarification" | "other";
  acknowledgement: string;
  line: string;
  candidateResponse?: string;
  reason: string;
};

/**
 * Native Gemini audio transport for conversational rounds. Hiring-manager
 * sessions use a blocking Gemini tool call for natural turn-taking; every
 * resulting state transition is still validated and persisted by the server.
 * Other interview families retain the direct transcript-submission path.
 */
export interface GeminiLiveInterviewerHandle {
  /** Sends a typed or selected answer through the same authoritative interview brain. */
  submitTypedAnswer(input: { text: string; startMs: number; endMs: number }): Promise<void>;
  /** Speaks a trusted workspace status without treating it as a candidate answer. */
  speakWorkspaceUpdate(text: string): boolean;
  reconnect(): void;
}

interface GeminiLiveInterviewerProps {
  sessionId: string;
  interviewerName: string;
  onStatus: (status: VoiceStatus) => void;
  onAgentState: (state: AgentState | null) => void;
  onAgentSpeaking: (speaking: boolean) => void;
  onAgentTrack: (track: MediaStreamTrack | null) => void;
  onLocalTrack: (track: MediaStreamTrack | null) => void;
  onError: (message: string | null) => void;
  onInputTranscript: (event: { text: string; finished: boolean }) => void;
  onOutputTranscript: (event: { text: string; finished: boolean }) => void;
  onAnswerPersisted: (response?: AuthoritativeResponse) => void | Promise<void>;
  onFinalResponseSpoken: () => void;
  microphoneDeviceId: string;
}

export const GeminiLiveInterviewer = forwardRef<
  GeminiLiveInterviewerHandle,
  GeminiLiveInterviewerProps
>(
  (
    {
      sessionId,
      interviewerName,
      onStatus,
      onAgentState,
      onAgentSpeaking,
      onAgentTrack,
      onLocalTrack,
      onError,
      onInputTranscript,
      onOutputTranscript,
      onAnswerPersisted,
      onFinalResponseSpoken,
      microphoneDeviceId
    },
    ref
  ) => {
    const callbacksRef = useRef({
      onStatus,
      onAgentState,
      onAgentSpeaking,
      onAgentTrack,
      onLocalTrack,
      onError,
      onInputTranscript,
      onOutputTranscript,
      onAnswerPersisted,
      onFinalResponseSpoken
    });
    const microphoneDeviceIdRef = useRef(microphoneDeviceId);
    const submitTypedAnswerRef = useRef<GeminiLiveInterviewerHandle["submitTypedAnswer"]>(
      async () => {
        throw new Error("The live interviewer is still connecting.");
      }
    );
    const speakWorkspaceUpdateRef = useRef<GeminiLiveInterviewerHandle["speakWorkspaceUpdate"]>(
      () => false
    );
    const reconnectRef = useRef<() => void>(() => undefined);
    const inputTranscriptRef = useRef("");
    const outputTranscriptRef = useRef("");
    callbacksRef.current = {
      onStatus,
      onAgentState,
      onAgentSpeaking,
      onAgentTrack,
      onLocalTrack,
      onError,
      onInputTranscript,
      onOutputTranscript,
      onAnswerPersisted,
      onFinalResponseSpoken
    };
    microphoneDeviceIdRef.current = microphoneDeviceId;

    useEffect(() => {
      let closed = false;
      let stream: MediaStream | null = null;
      let inputContext: AudioContext | null = null;
      let outputContext: AudioContext | null = null;
      let avatarDestination: MediaStreamAudioDestinationNode | null = null;
      let processor: ScriptProcessorNode | null = null;
      let session: LiveSession | null = null;
      let transcriptionChannel: TranscriptionChannel | null = null;
      let transcriptionRefreshTimer: number | null = null;
      let transcriptionRefreshInFlight = false;
      let dedicatedTranscriptionReady = false;
      let candidateUtteranceActive = false;
      let candidateStartedAtMs: number | null = null;
      let candidateFinalizedTranscript = "";
      let candidateCommitTimer: number | null = null;
      let interviewStartedAt = Date.now();
      let requestTranscriptionRefresh = () => undefined;
      let geminiLedConversation = false;
      let nextPlaybackTime = 0;
      let openingTurnPending = true;
      let openingTurnStarted = false;
      let approvedGeminiTurnPending = false;
      let approvedGeminiTurnStarted = false;
      let approvedResponseText: string | null = null;
      let approvedResponseHasAudio = false;
      let approvedResponseTurnComplete = false;
      let approvedResponseRetryCount = 0;
      let approvedResponseFallbackTimer: number | null = null;
      let decisionPending = false;
      let authoritativePromptSent = false;
      let authoritativeTurnStarted = false;
      let suppressCurrentModelTurn = false;
      let closingResponsePending = false;
      let closingResponseStarted = false;
      let closingResponseFallbackTimer: number | null = null;
      let workspaceUpdateFallbackTimer: number | null = null;
      let workspaceUpdateRetryTimer: number | null = null;
      const answersInFlight = new Set<string>();
      const completedToolCalls = new Set<string>();
      let lastCompletedCandidateTurn: { fingerprint: string; completedAtMs: number } | null = null;
      let lastAuthoritativeResponse: AuthoritativeResponse | null = null;
      let pendingTypedSubmission: {
        input: { text: string; startMs: number; endMs: number };
        resolve: () => void;
        reject: (error: Error) => void;
        timeout: number;
      } | null = null;
      let pendingWorkspaceUpdateText: string | null = null;
      let queuedWorkspaceUpdateText: string | null = null;
      const scheduled = new Set<AudioBufferSourceNode>();

      const resolvePendingTypedSubmission = () => {
        if (!pendingTypedSubmission) return;
        window.clearTimeout(pendingTypedSubmission.timeout);
        pendingTypedSubmission.resolve();
        pendingTypedSubmission = null;
      };

      const clearApprovedResponse = () => {
        if (approvedResponseFallbackTimer !== null) {
          window.clearTimeout(approvedResponseFallbackTimer);
          approvedResponseFallbackTimer = null;
        }
        approvedResponseText = null;
        approvedResponseHasAudio = false;
        approvedResponseTurnComplete = false;
        approvedResponseRetryCount = 0;
      };

      const finishApprovedResponsePlayback = () => {
        if (
          !approvedResponseText ||
          !approvedResponseHasAudio ||
          !approvedResponseTurnComplete ||
          scheduled.size > 0
        ) {
          return;
        }
        clearApprovedResponse();
        resolvePendingTypedSubmission();
      };

      const completeClosingResponse = () => {
        if (!closingResponsePending) return;
        closingResponsePending = false;
        closingResponseStarted = false;
        if (closingResponseFallbackTimer !== null) {
          window.clearTimeout(closingResponseFallbackTimer);
          closingResponseFallbackTimer = null;
        }
        if (workspaceUpdateFallbackTimer !== null) {
          window.clearTimeout(workspaceUpdateFallbackTimer);
          workspaceUpdateFallbackTimer = null;
        }
        if (workspaceUpdateRetryTimer !== null) {
          window.clearTimeout(workspaceUpdateRetryTimer);
          workspaceUpdateRetryTimer = null;
        }
        callbacksRef.current.onFinalResponseSpoken();
      };

      const updatePlaybackState = (speaking: boolean) => {
        callbacksRef.current.onAgentSpeaking(speaking);
        callbacksRef.current.onAgentState(speaking ? "speaking" : "listening");
        if (!speaking) finishApprovedResponsePlayback();
        if (closingResponsePending && speaking) closingResponseStarted = true;
        if (closingResponsePending && closingResponseStarted && !speaking) {
          completeClosingResponse();
        }
      };

      const stopPlayback = () => {
        scheduled.forEach((source) => source.stop());
        scheduled.clear();
        nextPlaybackTime = outputContext?.currentTime ?? 0;
        callbacksRef.current.onAgentSpeaking(false);
        callbacksRef.current.onAgentState("listening");
      };

      const teardown = () => {
        if (candidateCommitTimer !== null) {
          window.clearTimeout(candidateCommitTimer);
          candidateCommitTimer = null;
        }
        if (transcriptionRefreshTimer !== null) {
          window.clearTimeout(transcriptionRefreshTimer);
          transcriptionRefreshTimer = null;
        }
        if (closingResponseFallbackTimer !== null) {
          window.clearTimeout(closingResponseFallbackTimer);
          closingResponseFallbackTimer = null;
        }
        if (workspaceUpdateFallbackTimer !== null) {
          window.clearTimeout(workspaceUpdateFallbackTimer);
          workspaceUpdateFallbackTimer = null;
        }
        if (workspaceUpdateRetryTimer !== null) {
          window.clearTimeout(workspaceUpdateRetryTimer);
          workspaceUpdateRetryTimer = null;
        }
        if (approvedResponseFallbackTimer !== null) {
          window.clearTimeout(approvedResponseFallbackTimer);
          approvedResponseFallbackTimer = null;
        }
        queuedWorkspaceUpdateText = null;
        if (pendingTypedSubmission) {
          window.clearTimeout(pendingTypedSubmission.timeout);
          pendingTypedSubmission.reject(new Error("The live interviewer disconnected."));
          pendingTypedSubmission = null;
        }
        processor?.disconnect();
        inputContext?.close().catch(() => null);
        outputContext?.close().catch(() => null);
        stream?.getTracks().forEach((track) => track.stop());
        transcriptionChannel?.retire();
        session?.close();
        stopPlayback();
        callbacksRef.current.onAgentTrack(null);
        callbacksRef.current.onLocalTrack(null);
      };

      const speakAuthoritativeResponse = (response: AuthoritativeResponse) => {
        // Gemini 3.1 accepts post-opening text through realtime input. Sending
        // the authoritative response here avoids waiting for a model-generated
        // tool call before the server request can even begin.
        session?.sendRealtimeInput({
          text: `The interview server has finished reviewing the answer. Speak this exact response now, without adding or changing anything: ${JSON.stringify(response.utterance)}`
        });
      };

      const announceAuthoritativeResponse = (response: AuthoritativeResponse) => {
        // Any speculative model response to the candidate stays muted. The
        // next audible turn is always the server-approved utterance.
        decisionPending = false;
        authoritativePromptSent = true;
        authoritativeTurnStarted = false;
        outputTranscriptRef.current = response.utterance;
        // The approved text is already known. Render that complete text instead
        // of trusting packet-sized Gemini output captions, which can finish at
        // arbitrary fragments such as “That doesn't”.
        callbacksRef.current.onOutputTranscript({ text: response.utterance, finished: false });
        speakAuthoritativeResponse(response);
      };

      const persistAnswer = async (
        input: { text: string; startMs: number; endMs: number },
        options: {
          announce?: boolean;
          liveProposal?: LiveConversationProposal;
          submissionSource?: "voice" | "workspace";
        } = {}
      ) => {
        const answer = input.text.trim();
        if (!answer) return;
        const fingerprint = answerFingerprint(answer);
        if (
          answersInFlight.has(fingerprint) ||
          candidateAnswerWasRecentlySubmitted(answer, lastCompletedCandidateTurn)
        ) {
          return lastAuthoritativeResponse;
        }
        answersInFlight.add(fingerprint);
        callbacksRef.current.onAgentState("thinking");
        try {
          const decision = await submitAnswer({
            sessionId,
            turnId: crypto.randomUUID(),
            userAnswer: answer,
            startMs: input.startMs,
            endMs: input.endMs,
            submissionSource: options.submissionSource,
            liveProposal: options.liveProposal
          });
          lastAuthoritativeResponse = {
            answer: fingerprint,
            utterance: decision.utterance,
            action: decision.action,
            phase: decision.phase,
            questionIndex: decision.questionIndex
          };
          lastCompletedCandidateTurn = { fingerprint, completedAtMs: Date.now() };
          answersInFlight.delete(fingerprint);
          if (lastAuthoritativeResponse.phase === "done") {
            closingResponsePending = true;
            closingResponseStarted = false;
            if (closingResponseFallbackTimer !== null) {
              window.clearTimeout(closingResponseFallbackTimer);
            }
            // If the provider completes the turn without playable audio, do
            // not leave the candidate trapped in the finished interview.
            closingResponseFallbackTimer = window.setTimeout(completeClosingResponse, 20_000);
          }
          void callbacksRef.current.onAnswerPersisted(lastAuthoritativeResponse);
          if (options.announce !== false) {
            announceAuthoritativeResponse(lastAuthoritativeResponse);
          }
          return lastAuthoritativeResponse;
        } catch (error) {
          answersInFlight.delete(fingerprint);
          throw error;
        }
      };

      const hasPendingCandidateTurn = () =>
        candidateUtteranceActive ||
        candidateCommitTimer !== null ||
        Boolean(candidateFinalizedTranscript.trim()) ||
        Boolean(inputTranscriptRef.current.trim());

      const clearCandidateCommitTimer = () => {
        if (candidateCommitTimer === null) return;
        window.clearTimeout(candidateCommitTimer);
        candidateCommitTimer = null;
      };

      const commitCandidateTurn = () => {
        candidateCommitTimer = null;
        if (closed) return;
        if (decisionPending) {
          candidateCommitTimer = window.setTimeout(commitCandidateTurn, 250);
          return;
        }

        const completed = mergeFinalizedCandidateTranscript(
          candidateFinalizedTranscript,
          inputTranscriptRef.current
        );
        if (!completed) return;
        const now = Math.max(0, Date.now() - interviewStartedAt);
        const startMs = candidateStartedAtMs ?? now;
        candidateFinalizedTranscript = "";
        candidateStartedAtMs = null;
        candidateUtteranceActive = false;
        const rendered = finishAuthoritativeInputTranscript(
          completed,
          inputTranscriptRef,
          callbacksRef.current.onInputTranscript
        );
        if (!rendered) return;

        decisionPending = true;
        void persistAnswer({ text: rendered, startMs, endMs: now }).catch((error) => {
          decisionPending = false;
          callbacksRef.current.onError(
            error instanceof Error ? error.message : "Could not save your answer."
          );
        });
      };

      const scheduleCandidateTurnCommit = () => {
        clearCandidateCommitTimer();
        // In Gemini-led conversational rounds, Gemini's blocking tool call is the turn
        // boundary. The dedicated transcriber remains an accuracy source, but
        // no longer races the conversational model or forces it to stay mute.
        if (geminiLedConversation) return;
        candidateCommitTimer = window.setTimeout(
          commitCandidateTurn,
          LIVE_CANDIDATE_TURN_COMMIT_GRACE_MS
        );
      };

      const consumeCandidateTranscript = (
        fallback: string
      ): {
        text: string;
        startMs: number;
        endMs: number;
      } | null => {
        clearCandidateCommitTimer();
        const finalized = mergeFinalizedCandidateTranscript(
          candidateFinalizedTranscript,
          inputTranscriptRef.current
        ).trim();
        const modelTranscript = fallback.trim();
        // A Gemini-led turn already contains the model's complete verbatim tool
        // argument. Never merge a second recognizer's near-duplicate wording
        // into it (for example "NovaCart" + "Nova cars"), or one answer renders
        // twice inside the same saved message.
        const completed = selectGeminiLedCandidateTranscript(modelTranscript, finalized);
        if (!completed) return null;

        const endMs = Math.max(0, Date.now() - interviewStartedAt);
        const startMs = candidateStartedAtMs ?? endMs;
        candidateFinalizedTranscript = "";
        candidateStartedAtMs = null;
        candidateUtteranceActive = false;
        const rendered = finishAuthoritativeInputTranscript(
          completed,
          inputTranscriptRef,
          callbacksRef.current.onInputTranscript
        );
        return rendered ? { text: rendered, startMs, endMs } : null;
      };

      const consumeWorkspaceSubmission = (input: {
        text: string;
        startMs: number;
        endMs: number;
      }) => {
        clearCandidateCommitTimer();
        candidateFinalizedTranscript = "";
        candidateStartedAtMs = null;
        candidateUtteranceActive = false;
        inputTranscriptRef.current = "";
        const text = input.text.trim();
        if (!text) return null;
        callbacksRef.current.onInputTranscript({ text, finished: true });
        return { ...input, text };
      };

      const handleInterviewToolCall = async (call: {
        id?: string;
        name?: string;
        args?: Record<string, unknown>;
      }) => {
        if (!session || call.name !== COMPLETE_INTERVIEW_TURN_TOOL) return;
        if (pendingWorkspaceUpdateText) {
          approvedGeminiTurnPending = true;
          approvedGeminiTurnStarted = false;
          session.sendToolResponse({
            functionResponses: [
              {
                id: call.id,
                name: call.name,
                response: {
                  saved: false,
                  workspaceEvent: true,
                  approvedResponse: pendingWorkspaceUpdateText,
                  instruction:
                    "This was a workspace event, not a candidate answer. Do not advance or save it. Speak approvedResponse exactly once."
                }
              }
            ]
          });
          return;
        }
        if (call.id && completedToolCalls.has(call.id)) {
          session.sendToolResponse({
            functionResponses: [
              {
                id: call.id,
                name: call.name,
                response: {
                  saved: true,
                  duplicate: true,
                  approvedResponse: "",
                  instruction:
                    "This tool call was already completed. Do not repeat the previous response; listen for the candidate's next turn."
                }
              }
            ]
          });
          return;
        }
        if (decisionPending) {
          session.sendToolResponse({
            functionResponses: [
              {
                id: call.id,
                name: call.name,
                response: { error: "The previous interview turn is still being saved." }
              }
            ]
          });
          return;
        }

        decisionPending = true;
        callbacksRef.current.onAgentState("thinking");
        try {
          const fallback = typeof call.args?.answerText === "string" ? call.args.answerText : "";
          const pendingWorkspaceInput = pendingTypedSubmission?.input;
          const workspaceSubmission =
            pendingWorkspaceInput &&
            toolCallMatchesPendingTypedSubmission(fallback, pendingWorkspaceInput.text)
              ? pendingWorkspaceInput
              : undefined;
          const candidateTurn = workspaceSubmission
            ? consumeWorkspaceSubmission(workspaceSubmission)
            : consumeCandidateTranscript(fallback);
          if (!candidateTurn)
            throw new Error("I couldn't capture that answer. Please say it again.");

          // Gemini can retry a completed candidate turn with a fresh tool-call
          // ID after a network delay. Persistence already rejects the same
          // fingerprint, but returning the previous approved utterance here
          // would make James speak that response a second time.
          if (candidateAnswerWasRecentlySubmitted(candidateTurn.text, lastCompletedCandidateTurn)) {
            if (call.id) completedToolCalls.add(call.id);
            decisionPending = false;
            session.sendToolResponse({
              functionResponses: [
                {
                  id: call.id,
                  name: call.name,
                  response: {
                    saved: true,
                    duplicate: true,
                    approvedResponse: "",
                    instruction:
                      "This candidate turn was already completed. Produce no audio or text; listen for the candidate's next turn."
                  }
                }
              ]
            });
            resolvePendingTypedSubmission();
            callbacksRef.current.onAgentState("listening");
            return;
          }

          const response = await persistAnswer(candidateTurn, {
            announce: false,
            liveProposal: liveConversationProposalFromToolArgs(call.args, interviewerName),
            submissionSource: workspaceSubmission ? "workspace" : "voice"
          });
          if (!response) throw new Error("The interview turn was not saved.");
          if (call.id) completedToolCalls.add(call.id);
          decisionPending = false;

          // The server intentionally holds ordinary spoken reasoning on a code
          // prompt until the candidate clicks Submit in the workspace. A blank
          // authoritative utterance is a silent acknowledgement, not a reason
          // to ask Gemini to speak or to advance the interview.
          if (!response.utterance.trim()) {
            session.sendToolResponse({
              functionResponses: [
                {
                  id: call.id,
                  name: call.name,
                  response: {
                    saved: true,
                    action: response.action,
                    questionIndex: response.questionIndex,
                    approvedResponse: "",
                    instruction:
                      "Produce no audio or text for this turn. Stay silent and continue listening while the candidate works in the coding workspace."
                  }
                }
              ]
            });
            resolvePendingTypedSubmission();
            callbacksRef.current.onAgentState("listening");
            return;
          }

          // Only the model continuation caused by this authoritative tool
          // response may be heard. Any model audio produced before the tool
          // call is speculative and remains muted.
          approvedGeminiTurnPending = true;
          approvedGeminiTurnStarted = false;
          approvedResponseText = response.utterance;
          approvedResponseHasAudio = false;
          approvedResponseTurnComplete = false;
          approvedResponseRetryCount = 0;
          session.sendToolResponse({
            functionResponses: [
              {
                id: call.id,
                name: call.name,
                response: {
                  saved: true,
                  action: response.phase === "done" ? "close" : response.action,
                  questionIndex: response.questionIndex,
                  approvedResponse: response.utterance,
                  identity: `I'm ${interviewerName} from the recruiting team.`,
                  instruction:
                    response.phase === "done"
                      ? "Speak approvedResponse exactly once, word for word. Finish the complete closing before stopping."
                      : "Speak approvedResponse exactly once, word for word, without adding or paraphrasing anything. Never identify yourself as Google, Gemini, an AI, a model, a bot, or an assistant."
                }
              }
            ]
          });
          const retryApprovedAudio = () => {
            approvedResponseFallbackTimer = null;
            if (!approvedResponseText || approvedResponseHasAudio || !session) return;

            if (approvedResponseRetryCount >= 1) {
              approvedGeminiTurnPending = false;
              approvedGeminiTurnStarted = false;
              clearApprovedResponse();
              resolvePendingTypedSubmission();
              callbacksRef.current.onAgentState("listening");
              callbacksRef.current.onError(
                `${interviewerName}'s reply was saved, but the audio could not be played. You can continue from the written response.`
              );
              if (closingResponsePending) completeClosingResponse();
              return;
            }

            approvedResponseRetryCount += 1;
            approvedGeminiTurnPending = true;
            approvedGeminiTurnStarted = false;
            approvedResponseTurnComplete = false;
            callbacksRef.current.onAgentState("thinking");
            session.sendRealtimeInput({
              text: `The previous approved interview reply produced no playable audio. Speak this exact response now, once, without adding or changing anything: ${JSON.stringify(approvedResponseText)}`
            });
            approvedResponseFallbackTimer = window.setTimeout(
              retryApprovedAudio,
              APPROVED_AUDIO_FALLBACK_MS
            );
          };
          approvedResponseFallbackTimer = window.setTimeout(
            retryApprovedAudio,
            APPROVED_AUDIO_FALLBACK_MS
          );
        } catch (error) {
          decisionPending = false;
          const failure = error instanceof Error ? error : new Error("Could not save your answer.");
          session.sendToolResponse({
            functionResponses: [
              {
                id: call.id,
                name: call.name,
                response: {
                  error: failure.message,
                  instruction: "Ask the candidate to repeat once."
                }
              }
            ]
          });
          pendingTypedSubmission?.reject(failure);
          if (pendingTypedSubmission) window.clearTimeout(pendingTypedSubmission.timeout);
          pendingTypedSubmission = null;
          callbacksRef.current.onError(failure.message);
        }
      };

      const handleCandidateTranscript = (transcript: { text?: string }, finished: boolean) => {
        const incoming = transcript.text?.trim();
        if (!incoming) return;
        const now = Math.max(0, Date.now() - interviewStartedAt);
        candidateStartedAtMs ??= now;
        candidateUtteranceActive = !finished;

        // The Gemini-led room uses the tool's answerText as its single saved
        // transcript. Ignore parallel and late recognizer packets so they
        // cannot duplicate this answer or leak into the following one.
        if (geminiLedConversation) return;

        if (!finished) {
          // A new hypothesis means the candidate resumed after a natural
          // pause. Keep the earlier final segment and cancel its pending submit.
          clearCandidateCommitTimer();
          // Keep interim hypotheses private. Gemini rewrites them repeatedly
          // while the candidate speaks; the transcript should gain a user
          // message only when the final, corrected text is ready.
          bufferCandidateInterimTranscript(incoming, inputTranscriptRef);
          return;
        }

        // A Gemini final transcription is a finalized speech segment, not
        // necessarily the candidate's full answer. Accumulate it privately and
        // submit only after the candidate has remained silent through the
        // additional commit window.
        candidateFinalizedTranscript = mergeFinalizedCandidateTranscript(
          candidateFinalizedTranscript,
          incoming
        );
        inputTranscriptRef.current = "";
        scheduleCandidateTurnCommit();
      };

      const connect = async () => {
        try {
          callbacksRef.current.onStatus("connecting");
          const response = await fetch("/api/interview/gemini-live/token", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ sessionId })
          });
          const payload = await response.json();
          if (!response.ok || !payload?.success) {
            throw new Error(payload?.error?.message ?? "Could not prepare the live interviewer.");
          }
          const connection = payload.data as LiveTokenResponse;
          interviewStartedAt = connection.sessionStartedAt;
          geminiLedConversation = connection.conversationMode === "gemini-led";
          if (closed) return;

          const requestedDeviceId = microphoneDeviceIdRef.current;
          const audioConstraints: MediaTrackConstraints = {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            ...(requestedDeviceId ? { deviceId: { exact: requestedDeviceId } } : {})
          };
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
          } catch (error) {
            // A device can disappear between the setup screen and connection.
            // Fall back to the browser default instead of presenting a dead room.
            if (!requestedDeviceId) throw error;
            stream = await navigator.mediaDevices.getUserMedia({
              audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
            });
          }
          if (closed) {
            stream.getTracks().forEach((track) => track.stop());
            stream = null;
            return;
          }
          const microphone = stream.getAudioTracks()[0];
          if (!microphone) throw new Error("No microphone was found.");
          callbacksRef.current.onLocalTrack(microphone);

          // Asking Web Audio for 16 kHz lets the browser use its native
          // resampler instead of throwing away samples in JavaScript.
          try {
            inputContext = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
          } catch {
            inputContext = new AudioContext();
          }
          outputContext = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
          avatarDestination = outputContext.createMediaStreamDestination();
          callbacksRef.current.onAgentTrack(avatarDestination.stream.getAudioTracks()[0] ?? null);

          const scheduleTranscriptionRefresh = (delayMs: number) => {
            if (transcriptionRefreshTimer !== null) {
              window.clearTimeout(transcriptionRefreshTimer);
            }
            transcriptionRefreshTimer = window.setTimeout(requestTranscriptionRefresh, delayMs);
          };

          const createTranscriptionChannel = async (
            transcription: TranscriptionConnection
          ): Promise<TranscriptionChannel> => {
            let active = true;
            const transcriptionAi = new GoogleGenAI({
              apiKey: transcription.token,
              httpOptions: { apiVersion: "v1beta" }
            });
            const transcriptionSession = (await transcriptionAi.live.connect({
              model: transcription.model,
              config: {
                responseModalities: [Modality.TEXT],
                inputAudioTranscription: buildCandidateTranscriptionConfig(transcription),
                realtimeInputConfig: {
                  automaticActivityDetection: {
                    disabled: false,
                    startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
                    endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
                    prefixPaddingMs: 300,
                    silenceDurationMs: LIVE_END_OF_SPEECH_SILENCE_MS
                  }
                }
              },
              callbacks: {
                onopen: () => undefined,
                onmessage: (message) => {
                  if (closed || !active) return;
                  const content = message.serverContent;
                  if (content?.interimInputTranscription?.text) {
                    // Gemini 3.5 interim text is a revised snapshot of
                    // the utterance so far, not a delta. Appending successive
                    // hypotheses repeats whole phrases while the user speaks.
                    handleCandidateTranscript(content.interimInputTranscription, false);
                  }
                  if (content?.inputTranscription?.text) {
                    handleCandidateTranscript(content.inputTranscription, true);
                  }
                },
                onerror: () => {
                  if (closed || !active) return;
                  dedicatedTranscriptionReady = false;
                  requestTranscriptionRefresh();
                },
                onclose: () => {
                  if (closed || !active) return;
                  dedicatedTranscriptionReady = false;
                  requestTranscriptionRefresh();
                }
              }
            })) as LiveSession;

            return {
              session: transcriptionSession,
              retire: () => {
                active = false;
                transcriptionSession.close();
              }
            };
          };

          const replaceTranscriptionChannel = async () => {
            if (closed || transcriptionRefreshInFlight) return;
            if (hasPendingCandidateTurn() || decisionPending) {
              scheduleTranscriptionRefresh(5_000);
              return;
            }

            transcriptionRefreshInFlight = true;
            try {
              const tokenResponse = await fetch("/api/interview/gemini-live/token", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ sessionId, purpose: "transcription-refresh" })
              });
              const tokenPayload = await tokenResponse.json();
              if (!tokenResponse.ok || !tokenPayload?.success) {
                throw new Error(
                  tokenPayload?.error?.message ?? "Could not refresh interview transcription."
                );
              }
              const replacement = await createTranscriptionChannel(
                tokenPayload.data.transcription as TranscriptionConnection
              );
              if (closed) {
                replacement.retire();
                return;
              }
              // The old channel may have detected speech while the new
              // WebSocket was connecting. Never swap recognition engines in
              // the middle of an utterance or the replacement will miss its start.
              if (hasPendingCandidateTurn() || decisionPending) {
                replacement.retire();
                scheduleTranscriptionRefresh(5_000);
                return;
              }
              const previous = transcriptionChannel;
              transcriptionChannel = replacement;
              dedicatedTranscriptionReady = true;
              previous?.retire();
              scheduleTranscriptionRefresh(TRANSCRIPTION_ROTATION_MS);
            } catch {
              scheduleTranscriptionRefresh(TRANSCRIPTION_RETRY_MS);
            } finally {
              transcriptionRefreshInFlight = false;
            }
          };
          requestTranscriptionRefresh = () => {
            void replaceTranscriptionChannel();
          };

          const transcriptionPromise = connection.transcription
            ? createTranscriptionChannel(connection.transcription).catch(() => null)
            : Promise.resolve(null);
          const ai = new GoogleGenAI({
            apiKey: connection.token,
            httpOptions: { apiVersion: "v1beta" }
          });
          session = await ai.live.connect({
            model: connection.model,
            config: {
              responseModalities: [Modality.AUDIO],
              // The server derives this from the reserved interviewer persona
              // and locks the same value into the ephemeral token.
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: connection.voiceName } }
              },
              realtimeInputConfig: {
                automaticActivityDetection: {
                  disabled: false,
                  startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
                  endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
                  prefixPaddingMs: 300,
                  // Low end-of-speech sensitivity still protects natural pauses;
                  // the shorter shared window avoids adding two idle seconds to
                  // every conversational turn.
                  silenceDurationMs: LIVE_END_OF_SPEECH_SILENCE_MS
                },
                // The final behavioural room supports natural barge-in. Other
                // rounds retain the conservative noise-resistant behavior.
                activityHandling: geminiLedConversation
                  ? ActivityHandling.START_OF_ACTIVITY_INTERRUPTS
                  : ActivityHandling.NO_INTERRUPTION
              },
              systemInstruction: connection.systemInstruction,
              ...(geminiLedConversation ? { tools: GEMINI_LED_INTERVIEW_TOOLS } : {}),
              // Server-led rounds need a fallback when their separate
              // transcription socket disconnects. James's Gemini-led round
              // persists the transcript supplied by its required tool call.
              ...(!geminiLedConversation ? { inputAudioTranscription: {} } : {}),
              sessionResumption: {},
              contextWindowCompression: { slidingWindow: {} }
            },
            callbacks: {
              onopen: () => undefined,
              onmessage: (message) => {
                if (closed) return;
                if (geminiLedConversation && message.toolCall?.functionCalls) {
                  for (const call of message.toolCall.functionCalls) {
                    void handleInterviewToolCall(call);
                  }
                }
                const content = message.serverContent;
                if (content?.interrupted) {
                  stopPlayback();
                  if (geminiLedConversation) {
                    // Barge-in ends the previously authorized spoken turn. Do
                    // not let that stale authorization make the next
                    // pre-tool model response audible.
                    if (openingTurnStarted) {
                      openingTurnPending = false;
                      openingTurnStarted = false;
                    }
                    if (approvedGeminiTurnStarted) {
                      approvedGeminiTurnPending = false;
                      approvedGeminiTurnStarted = false;
                      clearApprovedResponse();
                      resolvePendingTypedSubmission();
                      pendingWorkspaceUpdateText = null;
                      if (workspaceUpdateFallbackTimer !== null) {
                        window.clearTimeout(workspaceUpdateFallbackTimer);
                        workspaceUpdateFallbackTimer = null;
                      }
                    }
                  }
                  // Realtime text can interrupt the speculative response. The
                  // next model content belongs to the authoritative prompt.
                  if (authoritativePromptSent) suppressCurrentModelTurn = false;
                }
                if (!dedicatedTranscriptionReady && content?.inputTranscription?.text) {
                  handleCandidateTranscript(content.inputTranscription, true);
                }
                if (!dedicatedTranscriptionReady && content?.interimInputTranscription?.text) {
                  handleCandidateTranscript(content.interimInputTranscription, false);
                }
                if (content?.modelTurn?.parts) {
                  if (geminiLedConversation) {
                    const audibleTurn = openingTurnPending || approvedGeminiTurnPending;
                    if (!audibleTurn) {
                      // A reply before complete_interview_turn, or a
                      // continuation caused by a duplicate tool response, is
                      // not an approved spoken turn.
                      outputTranscriptRef.current = "";
                    } else {
                      if (openingTurnPending) openingTurnStarted = true;
                      if (approvedGeminiTurnPending) approvedGeminiTurnStarted = true;
                      for (const part of content.modelTurn.parts) {
                        if (!part.inlineData?.data || !outputContext) continue;
                        if (approvedGeminiTurnPending && approvedResponseText) {
                          approvedResponseHasAudio = true;
                          callbacksRef.current.onError(null);
                          if (approvedResponseFallbackTimer !== null) {
                            window.clearTimeout(approvedResponseFallbackTimer);
                            approvedResponseFallbackTimer = null;
                          }
                        }
                        if (outputContext.state === "suspended") {
                          void outputContext.resume();
                        }
                        schedulePcmAudio(
                          outputContext,
                          avatarDestination,
                          part.inlineData.data,
                          scheduled,
                          updatePlaybackState,
                          (time) => {
                            nextPlaybackTime = Math.max(nextPlaybackTime, time);
                            return nextPlaybackTime;
                          }
                        );
                      }
                    }
                  } else {
                    // If Gemini begins replying while there is an uncommitted
                    // candidate transcript, it is attempting an unsupervised
                    // reply. Persist the answer now and deliberately discard this
                    // audio turn; the server's next response is the only question
                    // James may speak. This prevents a generic Gemini follow-up
                    // from being heard before the planned question.
                    const completed = mergeFinalizedCandidateTranscript(
                      candidateFinalizedTranscript,
                      inputTranscriptRef.current
                    );
                    if (completed) {
                      suppressCurrentModelTurn = true;
                      outputTranscriptRef.current = "";
                      if (inputTranscriptRef.current.trim()) {
                        // The voice channel also observed an end-of-speech
                        // boundary. Stage its latest hypothesis even when the
                        // dedicated transcriber is healthy; a later dedicated
                        // final packet will merge into this text and restart the
                        // same single-answer timer.
                        handleCandidateTranscript({ text: inputTranscriptRef.current }, true);
                      }
                    } else if (decisionPending && !authoritativePromptSent) {
                      suppressCurrentModelTurn = true;
                      outputTranscriptRef.current = "";
                    } else if (!openingTurnPending && !authoritativePromptSent) {
                      // Gemini may try to answer directly before its final input
                      // transcript packet arrives. Only the opening question and
                      // server-approved responses are allowed onto the speakers.
                      suppressCurrentModelTurn = true;
                      outputTranscriptRef.current = "";
                    } else if (!suppressCurrentModelTurn) {
                      if (openingTurnPending) openingTurnStarted = true;
                      if (authoritativePromptSent) authoritativeTurnStarted = true;
                      for (const part of content.modelTurn.parts) {
                        if (!part.inlineData?.data || !outputContext) continue;
                        schedulePcmAudio(
                          outputContext,
                          avatarDestination,
                          part.inlineData.data,
                          scheduled,
                          updatePlaybackState,
                          (time) => {
                            nextPlaybackTime = Math.max(nextPlaybackTime, time);
                            return nextPlaybackTime;
                          }
                        );
                      }
                    }
                  }
                }
                // A rejected Gemini response can arrive in many audio chunks.
                // Keep all of them muted until its complete turn has ended.
                if (content?.turnComplete) {
                  if (geminiLedConversation) {
                    if (openingTurnPending && openingTurnStarted) {
                      openingTurnPending = false;
                      openingTurnStarted = false;
                    }
                    const completedApprovedTurn =
                      approvedGeminiTurnPending && approvedGeminiTurnStarted;
                    if (completedApprovedTurn) {
                      approvedGeminiTurnPending = false;
                      approvedGeminiTurnStarted = false;
                      if (approvedResponseText) {
                        approvedResponseTurnComplete = true;
                        finishApprovedResponsePlayback();
                      }
                      if (pendingWorkspaceUpdateText) {
                        callbacksRef.current.onOutputTranscript({
                          text: pendingWorkspaceUpdateText,
                          finished: true
                        });
                        pendingWorkspaceUpdateText = null;
                        if (workspaceUpdateFallbackTimer !== null) {
                          window.clearTimeout(workspaceUpdateFallbackTimer);
                          workspaceUpdateFallbackTimer = null;
                        }
                      }
                    }
                    if (
                      closingResponsePending &&
                      completedApprovedTurn &&
                      !approvedResponseText
                    ) {
                      // Playback completion normally closes the room. If it
                      // completed before this packet, finish the durable turn.
                      completeClosingResponse();
                    } else if (
                      !closingResponsePending &&
                      !decisionPending &&
                      scheduled.size === 0
                    ) {
                      callbacksRef.current.onAgentState("listening");
                    }
                    return;
                  }
                  const approvedOpeningTurn = openingTurnPending && openingTurnStarted;
                  const approvedAuthoritativeTurn =
                    authoritativePromptSent && authoritativeTurnStarted;
                  const approvedTurn = approvedOpeningTurn || approvedAuthoritativeTurn;
                  const rejectedTurn = suppressCurrentModelTurn || !approvedTurn;
                  if (!rejectedTurn && approvedAuthoritativeTurn) {
                    finishTranscript(outputTranscriptRef, callbacksRef.current.onOutputTranscript);
                  } else {
                    if (!authoritativePromptSent) outputTranscriptRef.current = "";
                  }
                  suppressCurrentModelTurn = false;
                  if (rejectedTurn) {
                    if (decisionPending || authoritativePromptSent) {
                      callbacksRef.current.onAgentState("thinking");
                    }
                  } else if (approvedOpeningTurn) {
                    openingTurnPending = false;
                    openingTurnStarted = false;
                  } else if (approvedAuthoritativeTurn) {
                    authoritativePromptSent = false;
                    authoritativeTurnStarted = false;
                  }
                }
              },
              onerror: (event) => {
                if (closed) return;
                callbacksRef.current.onError(event.message || "The live interviewer disconnected.");
                callbacksRef.current.onStatus("error");
              },
              onclose: () => {
                if (closed) return;
                callbacksRef.current.onError(
                  "The live interviewer disconnected. Your saved answers are safe."
                );
                callbacksRef.current.onStatus("error");
              }
            }
          });
          if (closed) {
            session.close();
            session = null;
            return;
          }

          // Do not hold James's opening on a second WebSocket handshake. The
          // fallback transcript remains active until this promise resolves.
          void transcriptionPromise.then((channel) => {
            if (closed) {
              channel?.retire();
              return;
            }
            if (!connection.transcription) return;
            if (channel && hasPendingCandidateTurn()) {
              channel.retire();
              scheduleTranscriptionRefresh(5_000);
              return;
            }
            transcriptionChannel = channel;
            dedicatedTranscriptionReady = channel !== null;
            scheduleTranscriptionRefresh(
              channel ? TRANSCRIPTION_ROTATION_MS : TRANSCRIPTION_RETRY_MS
            );
          });
          callbacksRef.current.onStatus("live");
          callbacksRef.current.onAgentState("listening");

          // `onopen` may fire before the promise assigns `session`, so this must
          // be sent after connect resolves or Gemini can fall back to a generic
          // “what can I do for you?” greeting.
          session.sendClientContent({
            turns: [
              {
                role: "user",
                parts: [
                  {
                    text: `Start now. Your entire first spoken response must be this exact server-approved opening, with no additional words: ${JSON.stringify(connection.openingUtterance)}`
                  }
                ]
              }
            ],
            turnComplete: true
          });

          const source = inputContext.createMediaStreamSource(stream);
          // At the requested 16 kHz sample rate this produces 32 ms packets,
          // inside Google's recommended 20–40 ms streaming window.
          processor = inputContext.createScriptProcessor(512, 1, 1);
          processor.onaudioprocess = (event) => {
            if (closed || !session) return;
            const pcm = resampleToPcm16(
              event.inputBuffer.getChannelData(0),
              inputContext?.sampleRate ?? INPUT_SAMPLE_RATE
            );
            const audio = {
              data: bytesToBase64(new Uint8Array(pcm.buffer)),
              mimeType: "audio/pcm;rate=16000"
            };
            session.sendRealtimeInput({ audio });
            transcriptionChannel?.session.sendRealtimeInput({ audio });
          };
          source.connect(processor);
          processor.connect(inputContext.destination);
          submitTypedAnswerRef.current = async (input) => {
            if (!geminiLedConversation) {
              await persistAnswer(input);
              return;
            }
            if (
              !session ||
              pendingTypedSubmission ||
              decisionPending ||
              approvedGeminiTurnPending ||
              approvedResponseText ||
              scheduled.size > 0
            ) {
              throw new Error(`${interviewerName} is still responding to the previous answer.`);
            }
            candidateUtteranceActive = false;
            await new Promise<void>((resolve, reject) => {
              const timeout = window.setTimeout(() => {
                pendingTypedSubmission = null;
                approvedGeminiTurnPending = false;
                approvedGeminiTurnStarted = false;
                clearApprovedResponse();
                callbacksRef.current.onAgentState("listening");
                reject(
                  new Error(
                    `${interviewerName} could not complete the typed response. Your saved conversation is safe; please try continuing.`
                  )
                );
              }, 45_000);
              pendingTypedSubmission = { input, resolve, reject, timeout };
              session?.sendClientContent({
                turns: [{ role: "user", parts: [{ text: input.text }] }],
                turnComplete: true
              });
            });
          };
          speakWorkspaceUpdateRef.current = (text) => {
            const approved = text.trim();
            if (!approved || closed || !geminiLedConversation || !session) {
              return false;
            }
            if (
              decisionPending ||
              openingTurnPending ||
              approvedGeminiTurnPending ||
              pendingWorkspaceUpdateText
            ) {
              queuedWorkspaceUpdateText = approved;
              if (workspaceUpdateRetryTimer === null) {
                workspaceUpdateRetryTimer = window.setTimeout(() => {
                  workspaceUpdateRetryTimer = null;
                  const queued = queuedWorkspaceUpdateText;
                  queuedWorkspaceUpdateText = null;
                  if (queued) speakWorkspaceUpdateRef.current(queued);
                }, 500);
              }
              return true;
            }
            queuedWorkspaceUpdateText = null;
            pendingWorkspaceUpdateText = approved;
            approvedGeminiTurnPending = true;
            approvedGeminiTurnStarted = false;
            outputTranscriptRef.current = approved;
            callbacksRef.current.onOutputTranscript({ text: approved, finished: false });
            callbacksRef.current.onAgentState("thinking");
            workspaceUpdateFallbackTimer = window.setTimeout(() => {
              pendingWorkspaceUpdateText = null;
              approvedGeminiTurnPending = false;
              approvedGeminiTurnStarted = false;
              workspaceUpdateFallbackTimer = null;
              callbacksRef.current.onAgentState("listening");
            }, 12_000);
            session.sendRealtimeInput({
              text: `The coding workspace—not the candidate—reported an execution event. Do not call complete_interview_turn and do not advance the interview. Speak this exact approved line with no additional words: ${JSON.stringify(approved)}`
            });
            return true;
          };
          reconnectRef.current = () => {
            if (!closed) {
              callbacksRef.current.onStatus("connecting");
              session?.close();
            }
          };
        } catch (error) {
          if (closed) return;
          callbacksRef.current.onError(
            error instanceof Error ? error.message : "Could not connect the live interviewer."
          );
          callbacksRef.current.onStatus("error");
        }
      };

      // React Strict Mode mounts and immediately cleans up an effect once in
      // development. Deferring the connection prevents that discarded mount
      // from consuming a one-use token or acquiring and leaking the microphone.
      const connectTimer = window.setTimeout(() => void connect(), 0);
      return () => {
        closed = true;
        window.clearTimeout(connectTimer);
        teardown();
      };
    }, [interviewerName, sessionId]);

    useImperativeHandle(
      ref,
      () => ({
        submitTypedAnswer: (input) => submitTypedAnswerRef.current(input),
        speakWorkspaceUpdate: (text) => speakWorkspaceUpdateRef.current(text),
        reconnect: () => reconnectRef.current()
      }),
      []
    );

    return null;
  }
);

/**
 * Interim transcription is internal turn-detection state. The provider's
 * newest hypothesis replaces the older one and is deliberately not rendered.
 */
export function bufferCandidateInterimTranscript(
  text: string,
  current: MutableRefObject<string>
): string {
  const incoming = text.trim();
  if (!incoming) return "";
  current.current = incoming;
  return incoming;
}

export function buildCandidateTranscriptionConfig(
  transcription: Pick<TranscriptionConnection, "languageCodes" | "vocabulary">
) {
  return {
    languageCodes: transcription.languageCodes,
    customVocabulary: transcription.vocabulary,
    mode: AudioTranscriptionConfigMode.VERBATIM
  };
}

export function finishAuthoritativeInputTranscript(
  text: string,
  current: MutableRefObject<string>,
  emit: (event: { text: string; finished: boolean }) => void
): string {
  const completed = text.trim();
  if (!completed) return "";
  current.current = "";
  emit({ text: completed, finished: true });
  return completed;
}

/**
 * Joins provider-finalized speech segments without duplicating cumulative
 * snapshots. Gemini may send either the full answer-so-far or only the words
 * spoken after its last end-of-speech boundary.
 */
export function mergeFinalizedCandidateTranscript(previous: string, incoming: string): string {
  const left = previous.replace(/\s+/g, " ").trim();
  const right = incoming.replace(/\s+/g, " ").trim();
  if (!left) return right;
  if (!right) return left;

  const leftKey = left.toLocaleLowerCase();
  const rightKey = right.toLocaleLowerCase();
  if (rightKey === leftKey || leftKey.startsWith(`${rightKey} `)) return left;
  if (rightKey.startsWith(`${leftKey} `)) return right;

  const leftWords = left.split(" ");
  const rightWords = right.split(" ");
  const comparable = (word: string) => word.toLocaleLowerCase().replace(/[^a-z0-9']/g, "");
  const maximumOverlap = Math.min(leftWords.length, rightWords.length);
  for (let size = maximumOverlap; size >= 2; size -= 1) {
    const leftSuffix = leftWords.slice(-size).map(comparable).join(" ");
    const rightPrefix = rightWords.slice(0, size).map(comparable).join(" ");
    if (leftSuffix && leftSuffix === rightPrefix) {
      return `${left} ${rightWords.slice(size).join(" ")}`.trim();
    }
  }

  return `${left} ${right}`;
}

export function selectGeminiLedCandidateTranscript(
  modelTranscript: string,
  transcriptionFallback: string
): string {
  return modelTranscript.trim() || transcriptionFallback.trim();
}

export function liveConversationProposalFromToolArgs(
  args: Record<string, unknown> | undefined,
  interviewerName = "James"
): LiveConversationProposal {
  const action = args?.action;
  const missing = args?.missing;
  if (!isLiveAction(action) || !isMissingDimension(missing)) {
    throw new Error(
      `${interviewerName} returned an invalid interview decision. Please try that answer again.`
    );
  }

  const text = (key: string, limit: number) => {
    const value = args?.[key];
    return typeof value === "string" ? value.trim().slice(0, limit) : "";
  };
  const reason = text("reason", 200);
  if (!reason) throw new Error(`${interviewerName} did not finish the interview decision.`);

  return {
    action,
    missing,
    candidateIntent: isLiveCandidateIntent(args?.candidateIntent) ? args.candidateIntent : "other",
    acknowledgement: text("acknowledgement", 120),
    line: text("line", 300),
    candidateResponse: text("candidateResponse", 400) || undefined,
    reason
  };
}

function isLiveCandidateIntent(
  value: unknown
): value is LiveConversationProposal["candidateIntent"] {
  return ["answer", "decline", "end", "question-or-clarification", "other"].includes(String(value));
}

function isLiveAction(value: unknown): value is LiveConversationProposal["action"] {
  return ["clarify", "probe", "challenge", "respond", "move_on"].includes(String(value));
}

function isMissingDimension(value: unknown): value is LiveConversationProposal["missing"] {
  return ["clarity", "structure", "specificity", "ownership", "outcome", "none"].includes(
    String(value)
  );
}

function answerFingerprint(answer: string): string {
  return answer.replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

/** Prevents a nearby microphone tool call from consuming a typed submission marker. */
export function toolCallMatchesPendingTypedSubmission(
  toolAnswer: string,
  pendingTypedAnswer: string
): boolean {
  const toolFingerprint = answerFingerprint(toolAnswer);
  return Boolean(toolFingerprint && toolFingerprint === answerFingerprint(pendingTypedAnswer));
}

export function candidateAnswerWasRecentlySubmitted(
  answer: string,
  lastCompletedTurn: { fingerprint: string; completedAtMs: number } | null,
  nowMs = Date.now()
): boolean {
  return Boolean(
    lastCompletedTurn &&
    nowMs - lastCompletedTurn.completedAtMs >= 0 &&
    nowMs - lastCompletedTurn.completedAtMs <= DUPLICATE_TURN_WINDOW_MS &&
    lastCompletedTurn.fingerprint === answerFingerprint(answer)
  );
}

function finishTranscript(
  current: MutableRefObject<string>,
  emit: (event: { text: string; finished: boolean }) => void,
  fallback = ""
) {
  const text = current.current.trim() || fallback.trim();
  if (!text) return;
  emit({ text, finished: true });
  current.current = "";
}

export function resampleToPcm16(input: Float32Array, inputRate: number): Int16Array {
  const outputLength = Math.max(1, Math.round((input.length * INPUT_SAMPLE_RATE) / inputRate));
  const output = new Int16Array(outputLength);
  const ratio = inputRate / INPUT_SAMPLE_RATE;
  for (let index = 0; index < outputLength; index += 1) {
    const sourceStart = Math.min(input.length - 1, Math.floor(index * ratio));
    const sourceEnd = Math.min(
      input.length,
      Math.max(sourceStart + 1, Math.floor((index + 1) * ratio))
    );
    let total = 0;
    for (let sourceIndex = sourceStart; sourceIndex < sourceEnd; sourceIndex += 1) {
      total += input[sourceIndex] ?? 0;
    }
    // Averaging the source window is a small low-pass filter. It avoids the
    // aliasing introduced by the former nearest-sample conversion when a
    // browser ignores the requested 16 kHz AudioContext sample rate.
    const sample = Math.max(-1, Math.min(1, total / (sourceEnd - sourceStart)));
    output[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
}

function schedulePcmAudio(
  context: AudioContext,
  avatarDestination: MediaStreamAudioDestinationNode | null,
  encoded: string,
  scheduled: Set<AudioBufferSourceNode>,
  onSpeaking: (speaking: boolean) => void,
  reserveTime: (end: number) => number
) {
  const bytes = base64ToBytes(encoded);
  const samples = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
  const buffer = context.createBuffer(1, samples.length, OUTPUT_SAMPLE_RATE);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1)
    channel[index] = (samples[index] ?? 0) / 0x8000;
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  if (avatarDestination) source.connect(avatarDestination);
  const start = Math.max(context.currentTime + 0.03, reserveTime(context.currentTime));
  source.onended = () => {
    scheduled.delete(source);
    if (!scheduled.size) onSpeaking(false);
  };
  scheduled.add(source);
  onSpeaking(true);
  source.start(start);
  reserveTime(start + buffer.duration);
}

function bytesToBase64(bytes: Uint8Array): string {
  let text = "";
  bytes.forEach((byte) => (text += String.fromCharCode(byte)));
  return btoa(text);
}

function base64ToBytes(value: string): Uint8Array {
  const text = atob(value);
  return Uint8Array.from(text, (character) => character.charCodeAt(0));
}
