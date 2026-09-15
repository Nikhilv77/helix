/**
 * Shared latency budget for one live conversational turn.
 *
 * Keep the browser and ephemeral-token VAD values identical. The decision is
 * allowed a little longer than evaluation because speech cannot continue
 * without it; evaluation can be recovered after the response.
 */
export const LIVE_END_OF_SPEECH_SILENCE_MS = 900;
/**
 * Gemini can finalize transcription at a natural pause even when the candidate
 * is still answering. Keep those final segments private for one more beat so
 * a resumed explanation is coalesced into the same submitted turn.
 */
export const LIVE_CANDIDATE_TURN_COMMIT_GRACE_MS = 1_000;
export const LIVE_DECISION_DEADLINE_MS = 1_800;
export const LIVE_EVALUATION_DEADLINE_MS = 1_000;
