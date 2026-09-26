import { personaById } from "@/lib/avatars/personas";
import { STATIC_VOICE_LINES, type StaticVoiceLine } from "@/lib/avatars/static-voice.generated";
import { activeTtsProvider, voiceIdentity, type TtsProvider } from "@/lib/avatars/voice-style";

const byLine = new Map<string, StaticVoiceLine>(
  STATIC_VOICE_LINES.map((line) => [lineKey(line.provider, line.persona, line.text), line])
);

/**
 * A pre-generated file for exactly this teacher and text from the active
 * provider, or null. A changed voice or style also returns null so stale
 * audio is never played; the line then falls back to live speech.
 */
export function staticVoiceUrl(
  line: string,
  personaId?: string,
  provider: TtsProvider = activeTtsProvider()
): string | null {
  const persona = personaById(personaId);
  if (!persona) return null;
  const entry = byLine.get(lineKey(provider, persona.id, line));
  const expected = voiceIdentity(persona, provider);
  return entry && entry.voice === expected.voice && entry.style === expected.style
    ? entry.src
    : null;
}

function lineKey(provider: TtsProvider, personaId: string, text: string): string {
  return `${provider}\n${personaId}\n${text}`;
}
