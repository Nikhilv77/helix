import { createHash } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { personaById } from "@/lib/avatars/personas";
import { getAppContainer } from "@/server/app-container";
import { Logger } from "@/server/common/logger";
import { apiError } from "@/server/http/api-response";
import { ApiRouteError } from "@/server/http/api-error";
import { authenticatedOwnerId } from "@/server/interview/owner";
import { getSharedGuard, RATE_LIMIT_POLICIES } from "@/server/rate-limit/shared-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const DEEPGRAM_SPEAK_ENDPOINT = "https://api.deepgram.com/v1/speak";
const SPEECH_TIMEOUT_MS = 15_000;

/**
 * Maya says the same handful of lines to everyone, so identical text is
 * synthesised once per instance instead of on every replay.
 */
const CACHE_LIMIT = 64;
const audioCache = new Map<string, Buffer>();

const logger = new Logger("VoiceSpeak");

const speakSchema = z.object({
  text: z.string().trim().min(1).max(1_200),
  /**
   * A persona id, never a raw provider model. The client chooses who speaks;
   * the mapping to a Deepgram voice stays here, so no caller-supplied string
   * can reach the provider as a model parameter.
   */
  persona: z.string().trim().max(60).optional()
});

/**
 * GET so the browser can stream and cache it: an <audio> element pointed
 * straight at this URL starts playing on the first chunk, instead of waiting
 * for the whole file to arrive as a blob.
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");

    const parsed = speakSchema.safeParse({
      text: request.nextUrl.searchParams.get("text") ?? "",
      persona: request.nextUrl.searchParams.get("persona") ?? undefined
    });
    if (!parsed.success) {
      throw new ApiRouteError(
        400,
        "SPEECH_TEXT_INVALID",
        "Provide text between 1 and 1200 characters."
      );
    }

    const config = getAppContainer().config;
    const apiKey = config.deepgramApiKey;
    if (!apiKey) {
      throw new ApiRouteError(
        503,
        "SPEECH_UNAVAILABLE",
        "Trailgrad voice is not configured on this environment."
      );
    }

    // An unknown id falls back to the configured default rather than failing:
    // a retired persona should still be able to speak.
    const model = personaById(parsed.data.persona)?.voice ?? config.deepgramTtsModel;
    const cacheKey = createHash("sha256").update(`${model}:${parsed.data.text}`).digest("hex");
    const cached = audioCache.get(cacheKey);
    if (cached) return audioResponse(cached, "hit");

    // Cached lines are free replays. Only new provider work consumes the shared
    // request and character budgets.
    const guard = getSharedGuard(config);
    const ownerId = authenticatedOwnerId(userId);
    await guard.enforce(RATE_LIMIT_POLICIES.voiceGeneration, ownerId);
    await guard.enforce(RATE_LIMIT_POLICIES.voiceCharacters, ownerId, parsed.data.text.length);

    const upstream = await synthesize({ text: parsed.data.text, model, apiKey });
    if (!upstream.body) {
      return audioResponse(Buffer.from(await upstream.arrayBuffer()), "miss");
    }

    // One branch goes to the listener as it arrives, the other fills the cache.
    const [toClient, toCache] = upstream.body.tee();
    void collect(toCache)
      .then((audio) => rememberAudio(cacheKey, audio))
      .catch(() => undefined);

    return new Response(toClient, {
      status: 200,
      headers: {
        "content-type": "audio/mpeg",
        "cache-control": "private, max-age=3600",
        "x-trailgrad-voice-cache": "miss"
      }
    });
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

async function synthesize(input: {
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

function rememberAudio(key: string, audio: Buffer): void {
  if (audioCache.size >= CACHE_LIMIT) {
    const oldest = audioCache.keys().next().value;
    if (oldest) audioCache.delete(oldest);
  }
  audioCache.set(key, audio);
}

function audioResponse(audio: Buffer, cache: "hit" | "miss"): Response {
  return new Response(new Uint8Array(audio), {
    status: 200,
    headers: {
      "content-type": "audio/mpeg",
      "content-length": String(audio.byteLength),
      "cache-control": "private, max-age=3600",
      "x-trailgrad-voice-cache": cache
    }
  });
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
