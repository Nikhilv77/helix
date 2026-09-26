/**
 * Pre-generates fixed teacher lines as static MP3s so the app plays them from
 * the CDN instead of waiting ~7–9 s for live text-to-speech.
 *
 *   pnpm voice:lines                          # active provider (NEXT_PUBLIC_TTS_PROVIDER)
 *   pnpm voice:lines --provider deepgram      # or --provider gemini
 *   pnpm voice:lines --concurrency 8          # parallel requests (default: 8 Deepgram, 2 Gemini)
 *   pnpm voice:lines --limit 5                # generate at most 5 lines (a quick test)
 *   pnpm voice:lines --force                  # regenerate every line for that provider
 *   pnpm voice:lines --from-wav <dir>         # encode existing Gemini WAVs, no API calls
 *
 * Both providers' files can coexist; the app plays the set matching the active
 * provider, so switching providers is instant once a set is generated.
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
import { synthesizeGemini } from "../src/server/voice/gemini-speech";
import {
  activeTtsProvider,
  GEMINI_TTS_MODEL,
  isTtsProvider,
  TTS_PROVIDERS,
  voiceIdentity,
  type TtsProvider
} from "../src/lib/avatars/voice-style";

const OUTPUT_DIRECTORY = join("public", "voice");
const MANIFEST_PATH = join("src", "lib", "avatars", "static-voice.generated.ts");
const MP3_KBPS = 64;
const DEEPGRAM_SPEAK_ENDPOINT = "https://api.deepgram.com/v1/speak";
const force = process.argv.includes("--force");
const wavDirectory = argValue("--from-wav");
const requestedProvider = argValue("--provider");
if (requestedProvider !== null && !isTtsProvider(requestedProvider)) {
  throw new Error(`--provider must be one of: ${TTS_PROVIDERS.join(", ")}`);
}
const provider: TtsProvider = wavDirectory ? "gemini" : (requestedProvider ?? activeTtsProvider());
const concurrency = Math.max(
  1,
  Number(argValue("--concurrency")) || (provider === "deepgram" ? 8 : 2)
);

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

function fileNameFor({ persona, text }: Job, forProvider: TtsProvider): string {
  const { voice, style } = voiceIdentity(persona, forProvider);
  const model = forProvider === "gemini" ? GEMINI_TTS_MODEL : "deepgram";
  const hash = createHash("sha256")
    .update(JSON.stringify([style, model, voice, persona.id, text]))
    .digest("hex")
    .slice(0, 12);
  return `${persona.id}-${hash}.mp3`;
}

function manifestEntry(job: Job, fileName: string): StaticVoiceLine {
  return {
    provider,
    persona: job.persona.id,
    text: job.text,
    ...voiceIdentity(job.persona, provider),
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

async function synthesizeDeepgram(job: Job, apiKey: string): Promise<Buffer> {
  const { voice } = voiceIdentity(job.persona, "deepgram");
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(
      `${DEEPGRAM_SPEAK_ENDPOINT}?model=${encodeURIComponent(voice)}&encoding=mp3&bit_rate=48000`,
      {
        method: "POST",
        headers: { authorization: `Token ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ text: job.text })
      }
    );
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt >= 4) {
      throw new Error(`Deepgram ${response.status}: ${(await response.text()).slice(0, 160)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
  }
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
    (left, right) =>
      left.provider.localeCompare(right.provider) ||
      left.persona.localeCompare(right.persona) ||
      left.src.localeCompare(right.src)
  );
  writeFileSync(
    MANIFEST_PATH,
    `// Generated by scripts/generate-static-voice.mts. Do not edit by hand.
// Regenerate with \`pnpm voice:lines\` after changing a line, greeting, or voice.

export type StaticVoiceLine = {
  provider: "gemini" | "deepgram";
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
  const apiKey = provider === "gemini" ? process.env.GEMINI_API_KEY : process.env.DEEPGRAM_API_KEY;
  if (!apiKey && !wavDirectory) {
    throw new Error(
      `${provider === "gemini" ? "GEMINI_API_KEY" : "DEEPGRAM_API_KEY"} is required for --provider ${provider}.`
    );
  }
  mkdirSync(OUTPUT_DIRECTORY, { recursive: true });

  const wanted = jobs();
  // Files each provider should have; the other provider's set is kept untouched.
  const wantedByProvider = new Map<TtsProvider, Set<string>>(
    TTS_PROVIDERS.map((candidate) => [
      candidate,
      new Set(wanted.map((job) => fileNameFor(job, candidate)))
    ])
  );
  const manifest = new Map<string, StaticVoiceLine>(
    STATIC_VOICE_LINES.filter(
      (line) =>
        wantedByProvider.get(line.provider)?.has(line.src.replace("/voice/", "")) &&
        existsSync(join("public", line.src))
    ).map((line) => [line.src, line])
  );
  const limit = Number(argValue("--limit")) || Infinity;
  const missing = wanted.filter(
    (job) => force || !manifest.has(`/voice/${fileNameFor(job, provider)}`)
  );
  const pending = missing.slice(0, limit);
  process.stdout.write(
    `Provider ${provider}: ${wanted.length - missing.length}/${wanted.length} already generated, ${pending.length} to go (${concurrency} at a time).\n`
  );
  let generated = 0;
  let skipped = 0;
  const runStartedAt = performance.now();

  async function generate(job: Job): Promise<void> {
    const fileName = fileNameFor(job, provider);
    const label = `${job.persona.id}: “${job.text.slice(0, 44)}…”`;
    const startedAt = performance.now();
    let mp3: Buffer;
    try {
      if (wavDirectory) {
        const legacy = readdirSync(wavDirectory).find(
          (name) => name.startsWith(`${job.persona.id}-`) && name.endsWith(".wav")
        );
        if (!legacy || job.text !== job.persona.greeting) return;
        mp3 = wavToMp3(readFileSync(join(wavDirectory, legacy)));
      } else if (provider === "deepgram") {
        mp3 = await synthesizeDeepgram(job, apiKey!);
      } else {
        mp3 = wavToMp3(await synthesizeWithRetry(job, apiKey!));
      }
    } catch (error) {
      skipped += 1;
      process.stdout.write(
        `  skipped ${label} (${error instanceof Error ? error.message : String(error)})\n`
      );
      return;
    }
    writeFileSync(join(OUTPUT_DIRECTORY, fileName), mp3);
    manifest.set(`/voice/${fileName}`, manifestEntry(job, fileName));
    writeManifest([...manifest.values()]);
    generated += 1;
    process.stdout.write(
      `  [${generated}/${pending.length}] ${label} (${Math.round(mp3.byteLength / 1024)} KB, ${((performance.now() - startedAt) / 1000).toFixed(1)} s)\n`
    );
  }

  // A small worker pool: each worker takes the next pending line until none remain.
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, pending.length) }, async () => {
      while (next < pending.length) await generate(pending[next++]!);
    })
  );

  // Remove audio no longer referenced, such as superseded wording or voices.
  const referenced = new Set([...manifest.values()].map((line) => line.src.replace("/voice/", "")));
  for (const file of readdirSync(OUTPUT_DIRECTORY)) {
    if (file.endsWith(".mp3") && !referenced.has(file)) rmSync(join(OUTPUT_DIRECTORY, file));
  }
  writeManifest([...manifest.values()]);
  const ready = [...manifest.values()].filter((line) => line.provider === provider).length;
  process.stdout.write(
    `Provider ${provider}: ${ready}/${wanted.length} lines ready; ${generated} generated, ${skipped} skipped in ${((performance.now() - runStartedAt) / 1000).toFixed(0)} s.\n`
  );
  if (skipped) process.exitCode = 1;
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `Static voice generation failed: ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
});
