import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ALL_TEACHER_LINES } from "@/lib/voice/teacher-lines";
import { STATIC_VOICE_LINES } from "@/lib/avatars/static-voice.generated";
import { ALL_PERSONAS, personaById } from "@/lib/avatars/personas";
import { TTS_PROVIDERS, voiceIdentity } from "@/lib/avatars/voice-style";
import { staticVoiceUrl, voiceUrl } from "./use-maya-voice";

describe("voiceUrl", () => {
  it("requests the streaming delivery path for time-sensitive James speech", () => {
    expect(voiceUrl("The analysis is ready.", "james", "fast")).toContain("delivery=fast");
  });

  it("keeps ordinary James lines on the quality voice path", () => {
    expect(voiceUrl("Which position are you targeting?", "james")).not.toContain("delivery=");
  });
});

describe("pre-generated teacher lines", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("serves each line's static file for its own provider", () => {
    for (const line of STATIC_VOICE_LINES) {
      expect(staticVoiceUrl(line.text, line.persona, line.provider)).toBe(line.src);
    }
  });

  it("follows NEXT_PUBLIC_TTS_PROVIDER when choosing which set to play", () => {
    for (const provider of TTS_PROVIDERS) {
      vi.stubEnv("NEXT_PUBLIC_TTS_PROVIDER", provider);
      for (const line of STATIC_VOICE_LINES.filter((entry) => entry.provider === provider)) {
        expect(voiceUrl(line.text, line.persona)).toBe(line.src);
      }
    }
  });

  it("uses live speech for any other text, another teacher, and the fast path", () => {
    for (const line of STATIC_VOICE_LINES) {
      expect(staticVoiceUrl(`${line.text} Extra.`, line.persona, line.provider)).toBeNull();
      expect(voiceUrl(line.text, line.persona, "fast")).toContain("/api/voice/speak");
    }
    const [first] = STATIC_VOICE_LINES;
    if (first) {
      const other = ALL_PERSONAS.find(
        (persona) =>
          !STATIC_VOICE_LINES.some(
            (line) => line.persona === persona.id && line.text === first.text
          )
      );
      if (other) expect(staticVoiceUrl(first.text, other.id, first.provider)).toBeNull();
    }
  });

  it("keeps every manifest entry current and its MP3 on disk", () => {
    const wanted = new Set([
      ...ALL_PERSONAS.map((persona) => `${persona.id}\n${persona.greeting}`),
      ...ALL_PERSONAS.flatMap((persona) =>
        ALL_TEACHER_LINES.map((text) => `${persona.id}\n${text}`)
      )
    ]);
    for (const line of STATIC_VOICE_LINES) {
      const persona = personaById(line.persona);
      // A stale entry silently falls back to live speech; regenerate instead.
      expect(persona, `${line.persona} is no longer a persona`).not.toBeNull();
      expect(
        wanted.has(`${line.persona}\n${line.text}`),
        `${line.src} no longer matches its text; run pnpm voice:lines`
      ).toBe(true);
      expect({ voice: line.voice, style: line.style }).toEqual(
        voiceIdentity(persona!, line.provider)
      );
      const file = join(process.cwd(), "public", line.src);
      expect(existsSync(file), `${line.src} is missing`).toBe(true);
      const header = readFileSync(file).subarray(0, 3);
      // MPEG frame sync or an ID3 tag.
      expect(header[0] === 0xff || header.toString() === "ID3").toBe(true);
    }
  });
});
