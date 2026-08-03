import { createHash } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getAppContainer } from "@/server/app-container";
import { Logger } from "@/server/common/logger";
import { apiError } from "@/server/http/api-response";
import { ApiRouteError } from "@/server/http/api-error";

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
  text: z.string().trim().min(1).max(1_200)
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) throw new ApiRouteError(401, "AUTH_REQUIRED", "Authentication is required");

    const parsed = speakSchema.safeParse(await readJson(request));
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
        "Helix voice is not configured on this environment."
      );
    }

    const model = config.deepgramTtsModel;
    const cacheKey = createHash("sha256").update(`${model}:${parsed.data.text}`).digest("hex");
    const cached = audioCache.get(cacheKey);
    if (cached) return audioResponse(cached, "hit");

    const audio = await synthesize({ text: parsed.data.text, model, apiKey });
    rememberAudio(cacheKey, audio);

    return audioResponse(audio, "miss");
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

async function synthesize(input: { text: string; model: string; apiKey: string }): Promise<Buffer> {
  const controller = new AbortController();
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
        "Helix could not generate the voice line right now."
      );
    }

    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    if (error instanceof ApiRouteError) throw error;
    throw new ApiRouteError(
      504,
      "SPEECH_TIMEOUT",
      "Helix voice took too long to respond. Try again in a moment."
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
      "x-helix-voice-cache": cache
    }
  });
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
