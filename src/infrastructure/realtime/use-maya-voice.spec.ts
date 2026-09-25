import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GREETING_AUDIO } from "@/lib/avatars/greeting-audio.generated";
import { ALL_PERSONAS, personaById } from "@/lib/avatars/personas";
import { GEMINI_TTS_STYLE_VERSION } from "@/lib/avatars/voice-style";
import { staticGreetingUrl, voiceUrl } from "./use-maya-voice";

describe("voiceUrl", () => {
  it("requests the streaming delivery path for time-sensitive James speech", () => {
    expect(voiceUrl("The analysis is ready.", "james", "fast")).toContain("delivery=fast");
  });

  it("keeps ordinary James lines on the quality voice path", () => {
    expect(voiceUrl("Which position are you targeting?", "james")).not.toContain("delivery=");
  });
});

describe("pre-generated teacher greetings", () => {
  const generated = Object.keys(GREETING_AUDIO);

  it("serves a teacher's exact greeting from its static file", () => {
    for (const personaId of generated) {
      const persona = personaById(personaId)!;
      expect(voiceUrl(persona.greeting, persona.id)).toBe(GREETING_AUDIO[personaId]!.src);
    }
  });

  it("uses live speech for any other line, and for the fast path", () => {
    for (const personaId of generated) {
      const persona = personaById(personaId)!;
      expect(staticGreetingUrl(`${persona.greeting} Extra.`, persona.id)).toBeNull();
      expect(voiceUrl(persona.greeting, persona.id, "fast")).toContain("/api/voice/speak");
    }
  });

  it("keeps every manifest entry in step with its persona and on disk", () => {
    for (const [personaId, entry] of Object.entries(GREETING_AUDIO)) {
      const persona = ALL_PERSONAS.find((candidate) => candidate.id === personaId);
      // A stale entry would silently fall back to live speech; regenerate instead.
      expect(persona, `${personaId} is no longer a persona`).toBeDefined();
      expect(entry.text, `${personaId} greeting changed; run pnpm voice:greetings`).toBe(
        persona!.greeting
      );
      expect(entry.voice).toBe(persona!.geminiVoice);
      expect(entry.style).toBe(GEMINI_TTS_STYLE_VERSION);
      const file = join(process.cwd(), "public", entry.src);
      expect(existsSync(file), `${entry.src} is missing`).toBe(true);
      expect(readFileSync(file).subarray(0, 4).toString()).toBe("RIFF");
    }
  });
});
