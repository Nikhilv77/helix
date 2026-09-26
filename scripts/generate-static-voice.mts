/**
 * Pre-generates fixed teacher lines as static MP3s so the app plays them from
 * the CDN instead of waiting ~7–9 s for live text-to-speech.
 *
 *   pnpm voice:lines                    # generate missing or changed lines
 *   pnpm voice:lines --force            # regenerate every line
 *   pnpm voice:lines --from-wav <dir>   # encode existing WAVs instead of calling the API
 *
 * Lines: every persona's greeting, plus every fixed line in src/lib/voice/teacher-lines.ts for each
 * selectable teacher (the default teacher first). Progress is saved after each
 * file, so a run stopped by the daily quota resumes where it left off.
 *
 * Writes public/voice/<persona>-<hash>.mp3 and src/lib/avatars/static-voice.generated.ts.
 */
import { Mp3Encoder } from "@breezystack/lamejs";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ALL_TEACHER_LINES } from "../src/lib/voice/teacher-lines";
import {
  ALL_PERSONAS,
  DEFAULT_TEACHER_SELECTION_ID,
  SELECTABLE_TEACHERS,
  type InterviewerPersona
} from "../src/lib/avatars/personas";
import {
  STATIC_VOICE_LINES,
  type StaticVoiceLine
} from "../src/lib/avatars/static-voice.generated";
import {
  GEMINI_TTS_MODEL,
  GEMINI_TTS_STYLE_VERSION,
  synthesizeGemini
} from "../src/server/voice/gemini-speech";

const OUTPUT_DIRECTORY = join("public", "voice");
const MANIFEST_PATH = join("src", "lib", "avatars", "static-voice.generated.ts");
const MP3_KBPS = 64;
const force = process.argv.includes("--force");
const wavDirectory = argValue("--from-wav");

type Job = { persona: InterviewerPersona; text: string };

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

function jobs(): Job[] {
  const greetings = ALL_PERSONAS.filter((persona) => persona.greeting.trim()).map((persona) => ({
    persona,
    text: persona.greeting
  }));
  // Most learners keep the default teacher, so their lines are generated first.
  const teachers = [...SELECTABLE_TEACHERS].sort(
    (left, right) =>
      Number(right.id === DEFAULT_TEACHER_SELECTION_ID) -
      Number(left.id === DEFAULT_TEACHER_SELECTION_ID)
  );
  const practice = teachers.flatMap((persona) =>
    ALL_TEACHER_LINES.map((text) => ({ persona, text }))
  );
  return [...greetings, ...practice];
}

function fingerprint({ persona, text }: Job): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        GEMINI_TTS_STYLE_VERSION,
        GEMINI_TTS_MODEL,
        persona.geminiVoice,
        persona.id,
        text
      ])
    )
    .digest("hex")
    .slice(0, 12);
}

function manifestEntry(job: Job, fileName: string): StaticVoiceLine {
  return {
    persona: job.persona.id,
    text: job.text,
    voice: job.persona.geminiVoice,
    style: GEMINI_TTS_STYLE_VERSION,
    src: `/voice/${fileName}`
  };
}

/** 16-bit mono PCM WAV (what Gemini returns) to MP3. */
function wavToMp3(wav: Buffer): Buffer {
  if (wav.toString("ascii", 0, 4) !== "RIFF") throw new Error("Expected a WAV file");
  const channels = wav.readUInt16LE(22);
  const sampleRate = wav.readUInt32LE(24);
  const bitsPerSample = wav.readUInt16LE(34);
  if (channels !== 1 || bitsPerSample !== 16) {
    throw new Error(`Unsupported WAV: ${channels} channels, ${bitsPerSample}-bit`);
  }
  let offset = 12;
  while (wav.toString("ascii", offset, offset + 4) !== "data") {
    offset += 8 + wav.readUInt32LE(offset + 4);
  }
  const size = wav.readUInt32LE(offset + 4);
  const start = offset + 8;
  const samples = new Int16Array(size / 2);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = wav.readInt16LE(start + index * 2);
  }
  const encoder = new Mp3Encoder(1, sampleRate, MP3_KBPS);
  const chunks: Uint8Array[] = [];
  for (let index = 0; index < samples.length; index += 1152) {
    const encoded = encoder.encodeBuffer(samples.subarray(index, index + 1152));
    if (encoded.length) chunks.push(new Uint8Array(encoded));
  }
  const tail = encoder.flush();
  if (tail.length) chunks.push(new Uint8Array(tail));
  return Buffer.concat(chunks);
}

async function synthesizeWithRetry(job: Job, apiKey: string): Promise<Buffer> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const audio = await synthesizeGemini({ text: job.text, apiKey, persona: job.persona });
      if (audio.contentType !== "audio/wav") {
        throw new Error(`unexpected audio type ${audio.contentType}`);
      }
      return audio.bytes;
    } catch (error) {
      // Per-minute limits clear quickly; a daily limit will fail again and be skipped.
      if (attempt >= 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 20_000));
    }
  }
}

function writeManifest(lines: StaticVoiceLine[]): void {
  const sorted = [...lines].sort(
    (left, right) => left.persona.localeCompare(right.persona) || left.src.localeCompare(right.src)
  );
  writeFileSync(
    MANIFEST_PATH,
    `// Generated by scripts/generate-static-voice.mts. Do not edit by hand.
// Regenerate with \`pnpm voice:lines\` after changing a line, greeting, or voice.

export type StaticVoiceLine = {
  persona: string;
  text: string;
  voice: string;
  style: string;
  src: string;
};

export const STATIC_VOICE_LINES: readonly StaticVoiceLine[] = ${JSON.stringify(sorted, null, 2)};
`
  );
}

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey && !wavDirectory) throw new Error("GEMINI_API_KEY is required to generate lines.");
  mkdirSync(OUTPUT_DIRECTORY, { recursive: true });

  const wanted = jobs();
  const wantedFiles = new Set(wanted.map((job) => `${job.persona.id}-${fingerprint(job)}.mp3`));
  // Keep only entries that still describe a wanted line and exist on disk.
  const manifest = new Map<string, StaticVoiceLine>(
    STATIC_VOICE_LINES.filter(
      (line) =>
        wantedFiles.has(line.src.replace("/voice/", "")) && existsSync(join("public", line.src))
    ).map((line) => [line.src, line])
  );
  let generated = 0;
  let skipped = 0;

  for (const job of wanted) {
    const fileName = `${job.persona.id}-${fingerprint(job)}.mp3`;
    const src = `/voice/${fileName}`;
    if (!force && manifest.has(src)) continue;
    const label = `${job.persona.id}: “${job.text.slice(0, 48)}…”`;
    let wav: Buffer;
    const startedAt = performance.now();
    try {
      if (wavDirectory) {
        const legacy = readdirSync(wavDirectory).find(
          (name) => name.startsWith(`${job.persona.id}-`) && name.endsWith(".wav")
        );
        if (!legacy || job.text !== job.persona.greeting) continue;
        wav = readFileSync(join(wavDirectory, legacy));
      } else {
        wav = await synthesizeWithRetry(job, apiKey!);
      }
    } catch (error) {
      skipped += 1;
      process.stdout.write(
        `  skipped ${label} (${error instanceof Error ? error.message : String(error)})\n`
      );
      continue;
    }
    const mp3 = wavToMp3(wav);
    writeFileSync(join(OUTPUT_DIRECTORY, fileName), mp3);
    manifest.set(src, manifestEntry(job, fileName));
    writeManifest([...manifest.values()]);
    generated += 1;
    process.stdout.write(
      `  ${label} → ${fileName} (${Math.round(mp3.byteLength / 1024)} KB, ${((performance.now() - startedAt) / 1000).toFixed(1)} s)\n`
    );
  }

  // Remove audio no longer referenced, such as superseded wording or voices.
  const referenced = new Set([...manifest.values()].map((line) => line.src.replace("/voice/", "")));
  for (const file of readdirSync(OUTPUT_DIRECTORY)) {
    if (file.endsWith(".mp3") && !referenced.has(file)) rmSync(join(OUTPUT_DIRECTORY, file));
  }
  writeManifest([...manifest.values()]);
  process.stdout.write(
    `${manifest.size}/${wanted.length} lines ready; ${generated} generated, ${skipped} skipped.\n`
  );
  if (skipped) process.exitCode = 1;
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `Static voice generation failed: ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
});
