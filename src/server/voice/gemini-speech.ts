import { GoogleGenAI, Modality } from "@google/genai";
import type { InterviewerPersona } from "@/lib/avatars/personas";
import { ApiRouteError } from "@/server/http/api-error";

import { GEMINI_TTS_MODEL } from "@/lib/avatars/voice-style";

// Shared by live speech and pre-generated greetings so both sound identical.
export { GEMINI_TTS_MODEL, GEMINI_TTS_STYLE_VERSION } from "@/lib/avatars/voice-style";
const GEMINI_SPEECH_TIMEOUT_MS = 30_000;

export interface SynthesizedAudio {
  bytes: Buffer;
  contentType: string;
}

export async function synthesizeGemini(input: {
  text: string;
  apiKey: string;
  persona: InterviewerPersona;
}): Promise<SynthesizedAudio> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_SPEECH_TIMEOUT_MS);

  try {
    const client = new GoogleGenAI({ apiKey: input.apiKey });
    const response = await client.models.generateContent({
      model: GEMINI_TTS_MODEL,
      contents: `Read the transcript exactly as written. Do not add, omit, paraphrase, or explain anything.

You are ${input.persona.name}, a one-to-one technical interview coach speaking directly to one learner. Your manner is: ${input.persona.manner}

Understand the sentence before speaking it. Use natural emphasis based on meaning, brief pauses at punctuation, and a comfortable conversational pace around 145 words per minute. Sound present and human, not like an announcer or an audiobook narrator. Never read these directions aloud.

Transcript:
${input.text}`,
      config: {
        abortSignal: controller.signal,
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: input.persona.geminiVoice }
          }
        }
      }
    });
    const part = response.candidates?.[0]?.content?.parts?.find((candidate) =>
      Boolean(candidate.inlineData?.data)
    );
    const encoded = part?.inlineData?.data ?? response.data;
    if (!encoded) throw new Error("Gemini TTS returned no audio");

    const bytes = Buffer.from(encoded, "base64");
    const mimeType = part?.inlineData?.mimeType?.toLowerCase() ?? "audio/l16;rate=24000";
    if (mimeType.includes("l16") || mimeType.includes("pcm")) {
      return { bytes: pcmToWav(bytes, sampleRateFromMimeType(mimeType)), contentType: "audio/wav" };
    }
    return { bytes, contentType: mimeType };
  } catch (error) {
    if (error instanceof ApiRouteError) throw error;
    const quotaRetryAfterMs = geminiQuotaRetryAfterMs(error);
    if (quotaRetryAfterMs !== null) {
      throw new ApiRouteError(429, "SPEECH_QUOTA_EXHAUSTED", "Trailgrad voice is busy right now.", {
        retryAfterMs: quotaRetryAfterMs
      });
    }
    throw new ApiRouteError(
      controller.signal.aborted ? 504 : 502,
      controller.signal.aborted ? "SPEECH_TIMEOUT" : "SPEECH_PROVIDER_FAILED",
      controller.signal.aborted
        ? "Trailgrad voice took too long to respond. Try again in a moment."
        : "Trailgrad could not generate the voice line right now."
    );
  } finally {
    clearTimeout(timeout);
  }
}

function sampleRateFromMimeType(mimeType: string): number {
  const match = /rate=(\d+)/i.exec(mimeType);
  const sampleRate = Number(match?.[1] ?? 24_000);
  return Number.isFinite(sampleRate) && sampleRate > 0 ? sampleRate : 24_000;
}

function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  const channels = 1;
  const bitsPerSample = 16;
  const blockAlign = (channels * bitsPerSample) / 8;

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * blockAlign, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/**
 * How long Gemini asked us to wait after a quota refusal, or null when the
 * error is not a quota refusal. A daily quota resets at midnight Pacific time.
 */
export function geminiQuotaRetryAfterMs(error: unknown, now = new Date()): number | null {
  const message = error instanceof Error ? error.message : String(error);
  const status = (error as { status?: unknown } | null)?.status;
  if (status !== 429 && !/RESOURCE_EXHAUSTED|"code":\s*429/.test(message)) return null;
  if (/PerDay/i.test(message)) return msUntilPacificMidnight(now);
  const retry = /retry in ([\d.]+)s/i.exec(message);
  return retry ? Math.ceil(Number(retry[1]) * 1_000) : 60_000;
}

function msUntilPacificMidnight(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23"
  }).formatToParts(now);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const elapsed = (value("hour") * 3_600 + value("minute") * 60 + value("second")) * 1_000;
  return 86_400_000 - elapsed;
}
