import { personaById } from "@/lib/avatars/personas";
import { STATIC_VOICE_LINES, type StaticVoiceLine } from "@/lib/avatars/static-voice.generated";
import { GEMINI_TTS_STYLE_VERSION } from "@/lib/avatars/voice-style";

const byPersonaAndText = new Map<string, StaticVoiceLine>(
  STATIC_VOICE_LINES.map((line) => [lineKey(line.persona, line.text), line])
);

/**
 * A pre-generated file for exactly this teacher and text, or null. A changed
 * voice or style also returns null so stale audio is never played.
 */
export function staticVoiceUrl(line: string, personaId?: string): string | null {
  const persona = personaById(personaId);
  if (!persona) return null;
  const entry = byPersonaAndText.get(lineKey(persona.id, line));
  return entry && entry.voice === persona.geminiVoice && entry.style === GEMINI_TTS_STYLE_VERSION
    ? entry.src
    : null;
}

function lineKey(personaId: string, text: string): string {
  return `${personaId}\n${text}`;
}
