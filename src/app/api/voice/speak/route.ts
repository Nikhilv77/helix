import { createHash } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenAI, Modality } from "@google/genai";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { MAYA, personaById, type InterviewerPersona } from "@/lib/avatars/personas";
import { getAppContainer } from "@/server/app-container";
import { Logger } from "@/server/common/logger";
import { apiError } from "@/server/http/api-response";
import { ApiRouteError } from "@/server/http/api-error";
import { authenticatedOwnerId } from "@/features/interviews/server/owner";
import { getSharedGuard, RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";

export const dynamic = "force-dynamic";

const DEEPGRAM_SPEAK_ENDPOINT = "https://api.deepgram.com/v1/speak";
const GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";
const GEMINI_TTS_STYLE_VERSION = "teacher-natural-v1";
const SPEECH_TIMEOUT_MS = 15_000;
const GEMINI_SPEECH_TIMEOUT_MS = 30_000;

/** Identical lines are synthesised once per instance instead of on every replay. */
const CACHE_LIMIT = 64;
interface CachedAudio {
  bytes: Buffer;
  contentType: string;
}

const audioCache = new Map<string, CachedAudio>();

const logger = new Logger("VoiceSpeak");

const speakSchema = z.object({
  text: z.string().trim().min(1).max(1_200),
  /**
   * A persona id, never a raw provider model. Provider and voice selection stay
   * on the server, so no caller-supplied string can reach a model parameter.
   */
  persona: z.string().trim().max(60).optional(),
  delivery: z.enum(["quality", "fast"]).optional()
});

/**
 * GET lets the browser reuse its normal media loading and caching path.
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");

    const parsed = speakSchema.safeParse({
      text: request.nextUrl.searchParams.get("text") ?? "",
      persona: request.nextUrl.searchParams.get("persona") ?? undefined,
      delivery: request.nextUrl.searchParams.get("delivery") ?? undefined
    });
    if (!parsed.success) {
      throw new ApiRouteError(
        400,
        "SPEECH_TEXT_INVALID",
        "Provide text between 1 and 1200 characters."
      );
    }

    const config = getAppContainer().config;
    const persona = personaById(parsed.data.persona) ?? MAYA;
    const fallbackModel = persona.voice || config.deepgramTtsModel;
    const useGemini = parsed.data.delivery !== "fast" && Boolean(config.geminiApiKey);
    const cacheKey = createHash("sha256")
      .update(
        useGemini
          ? `gemini:${GEMINI_TTS_STYLE_VERSION}:${GEMINI_TTS_MODEL}:${persona.geminiVoice}:${persona.id}:${parsed.data.text}`
          : `deepgram:${fallbackModel}:${parsed.data.text}`
      )
      .digest("hex");
    const cached = audioCache.get(cacheKey);
    if (cached) return audioResponse(cached, "hit");

    // Cached lines are free replays. Only new provider work consumes the shared
    // request and character budgets.
    const guard = getSharedGuard(config);
    const ownerId = authenticatedOwnerId(userId);
    await Promise.all([
      guard.enforce(RATE_LIMIT_POLICIES.voiceGeneration, ownerId),
      guard.enforce(RATE_LIMIT_POLICIES.voiceCharacters, ownerId, parsed.data.text.length)
    ]);

    if (useGemini) {
      try {
        const generated = await synthesizeGemini({
          text: parsed.data.text,
          apiKey: config.geminiApiKey,
          persona
        });
        rememberAudio(cacheKey, generated);
        return audioResponse(generated, "miss");
      } catch (error) {
        const fallbackKey = createHash("sha256")
          .update(`deepgram:${fallbackModel}:${parsed.data.text}`)
          .digest("hex");
        const fallbackCached = audioCache.get(fallbackKey);
        if (fallbackCached) return audioResponse(fallbackCached, "hit");
        if (!config.deepgramApiKey) throw error;
        logger.warn(
          JSON.stringify({
            event: "voice.gemini_fallback",
            personaId: persona.id,
            reason: error instanceof ApiRouteError ? error.code : "SPEECH_PROVIDER_FAILED"
          })
        );
        const upstream = await synthesizeDeepgram({
          text: parsed.data.text,
          model: fallbackModel,
          apiKey: config.deepgramApiKey
        });
        return streamDeepgram(upstream, fallbackKey);
      }
    }

    const apiKey = config.deepgramApiKey;
    if (!apiKey) {
      throw new ApiRouteError(
        503,
        "SPEECH_UNAVAILABLE",
        "Trailgrad voice is not configured on this environment."
      );
    }
    const upstream = await synthesizeDeepgram({
      text: parsed.data.text,
      model: fallbackModel,
      apiKey
    });
    return streamDeepgram(upstream, cacheKey);
  } catch (error) {
    if (!(error instanceof ApiRouteError)) {
      logger.error(
        JSON.stringify({
          event: "voice.speak.failed",
          reason: error instanceof Error ? error.message : String(error)
        })
      );
    }
    return apiError(error, request.nextUrl.pathname);
  }
}

async function streamDeepgram(upstream: Response, cacheKey: string): Promise<Response> {
  const contentType = upstream.headers.get("content-type") ?? "audio/mpeg";
  if (!upstream.body) {
    const generated = { bytes: Buffer.from(await upstream.arrayBuffer()), contentType };
    rememberAudio(cacheKey, generated);
    return audioResponse(generated, "miss");
  }

  // One branch goes to the listener as it arrives, the other fills the cache.
  const [toClient, toCache] = upstream.body.tee();
  void collect(toCache)
    .then((bytes) => rememberAudio(cacheKey, { bytes, contentType }))
    .catch(() => undefined);

  return new Response(toClient, {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": "private, max-age=3600",
      "x-trailgrad-voice-cache": "miss"
    }
  });
}

async function synthesizeDeepgram(input: {
  text: string;
  model: string;
  apiKey: string;
}): Promise<Response> {
  const controller = new AbortController();
  // Cleared once the headers land: the body keeps streaming after that, and
  // aborting mid-stream would truncate the audio.
  const timeout = setTimeout(() => controller.abort(), SPEECH_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${DEEPGRAM_SPEAK_ENDPOINT}?model=${encodeURIComponent(input.model)}&encoding=mp3`,
      {
        method: "POST",
        headers: {
          authorization: `Token ${input.apiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({ text: input.text }),
        signal: controller.signal
      }
    );

    if (!response.ok) {
      logger.error(
        JSON.stringify({
          event: "voice.provider.failed",
          status: response.status,
          model: input.model
        })
      );
      throw new ApiRouteError(
        502,
        "SPEECH_PROVIDER_FAILED",
        "Trailgrad could not generate the voice line right now."
      );
    }

    return response;
  } catch (error) {
    if (error instanceof ApiRouteError) throw error;
    throw new ApiRouteError(
      504,
      "SPEECH_TIMEOUT",
      "Trailgrad voice took too long to respond. Try again in a moment."
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function synthesizeGemini(input: {
  text: string;
  apiKey: string;
  persona: InterviewerPersona;
}): Promise<CachedAudio> {
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

function rememberAudio(key: string, audio: CachedAudio): void {
  if (audioCache.size >= CACHE_LIMIT) {
    const oldest = audioCache.keys().next().value;
    if (oldest) audioCache.delete(oldest);
  }
  audioCache.set(key, audio);
}

function audioResponse(audio: CachedAudio, cache: "hit" | "miss"): Response {
  return new Response(new Uint8Array(audio.bytes), {
    status: 200,
    headers: {
      "content-type": audio.contentType,
      "content-length": String(audio.bytes.byteLength),
      "cache-control": "private, max-age=3600",
      "x-trailgrad-voice-cache": cache
    }
  });
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

async function collect(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  return Buffer.concat(chunks);
}
