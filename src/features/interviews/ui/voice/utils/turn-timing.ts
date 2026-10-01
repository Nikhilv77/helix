/**
 * Where a live turn's wait goes, from the candidate's last word to the first
 * audio of the interviewer's reply. Each turn's timings travel with the next
 * answer to the decide route, which logs them; no extra request is made.
 */
export interface VoiceTurnTimings {
  /** Last transcript update (end of speech) to the answer request starting. */
  speechToRequestMs: number | null;
  /** The decide request round trip, including the server's work. */
  requestMs: number | null;
  /** Approved response received to its first audio playing. */
  responseToAudioMs: number | null;
  /** The whole wait the candidate hears. */
  speechToAudioMs: number | null;
}

export function createTurnTimer(now: () => number = () => performance.now()) {
  let lastSpeechAt: number | null = null;
  let requestStartedAt: number | null = null;
  let responseAt: number | null = null;
  let waitingForAudio = false;
  let report: VoiceTurnTimings | null = null;
  const span = (from: number | null, to: number | null) =>
    from === null || to === null ? null : Math.max(0, Math.round(to - from));

  return {
    /** The candidate is speaking; the latest call marks the end of speech. */
    speech() {
      // Once the answer is on its way, later sound (a cough, the reply leaking
      // into the microphone) must not move this turn's end of speech.
      if (requestStartedAt === null) lastSpeechAt = now();
    },
    requestStarted() {
      requestStartedAt = now();
    },
    /** A failed request produces no reply audio; start the next turn clean. */
    reset() {
      lastSpeechAt = null;
      requestStartedAt = null;
      responseAt = null;
      waitingForAudio = false;
    },
    responseReceived() {
      responseAt = now();
      waitingForAudio = true;
    },
    /** First reply audio. Returns the finished turn once, then resets. */
    audioStarted(): VoiceTurnTimings | null {
      if (!waitingForAudio) return null;
      waitingForAudio = false;
      const audioAt = now();
      const timings: VoiceTurnTimings = {
        speechToRequestMs: span(lastSpeechAt, requestStartedAt),
        requestMs: span(requestStartedAt, responseAt),
        responseToAudioMs: span(responseAt, audioAt),
        speechToAudioMs: span(lastSpeechAt, audioAt)
      };
      report = timings;
      lastSpeechAt = null;
      requestStartedAt = null;
      responseAt = null;
      return timings;
    },
    /** The last finished turn, handed over once to ride on the next request. */
    takeReport(): VoiceTurnTimings | undefined {
      const taken = report ?? undefined;
      report = null;
      return taken;
    }
  };
}
