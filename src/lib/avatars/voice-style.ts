import type { InterviewerPersona } from "@/lib/avatars/personas";

/**
 * Text-to-speech provider and voice identity, shared by the browser, the speak
 * route, and the static-line generator so all three agree on which audio is
 * current. Switch providers with `NEXT_PUBLIC_TTS_PROVIDER` (`gemini` or
 * `deepgram`); pre-generated lines for either provider can coexist.
 */
export const TTS_PROVIDERS = ["gemini", "deepgram"] as const;
export type TtsProvider = (typeof TTS_PROVIDERS)[number];

export const GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";
export const GEMINI_TTS_STYLE_VERSION = "teacher-natural-v1";
/** Deepgram lines are MP3 from the persona's Aura voice with no style prompt. */
export const DEEPGRAM_TTS_STYLE_VERSION = "aura-v1";
const DEFAULT_DEEPGRAM_VOICE = "aura-2-asteria-en";

export function isTtsProvider(value: unknown): value is TtsProvider {
  return typeof value === "string" && (TTS_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Default provider for live teacher speech. Deepgram while the Gemini API is on
 * its free tier (10 speech requests a day); set NEXT_PUBLIC_TTS_PROVIDER=gemini
 * to switch without a code change.
 */
export const DEFAULT_TTS_PROVIDER: TtsProvider = "deepgram";

/** The provider for live teacher speech. */
export function activeTtsProvider(): TtsProvider {
  // Referenced literally so Next.js inlines it into the browser bundle.
  const configured = process.env.NEXT_PUBLIC_TTS_PROVIDER;
  return isTtsProvider(configured) ? configured : DEFAULT_TTS_PROVIDER;
}

/** Which voice and style a persona's audio uses under a provider. */
export function voiceIdentity(
  persona: Pick<InterviewerPersona, "voice" | "geminiVoice">,
  provider: TtsProvider
): { voice: string; style: string } {
  return provider === "gemini"
    ? { voice: persona.geminiVoice, style: GEMINI_TTS_STYLE_VERSION }
    : { voice: persona.voice || DEFAULT_DEEPGRAM_VOICE, style: DEEPGRAM_TTS_STYLE_VERSION };
}
