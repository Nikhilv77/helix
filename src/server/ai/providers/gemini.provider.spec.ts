import { Logger } from "../../common/logger";
import { GenerateContentParameters } from "@google/genai";
import { z } from "zod";
import { AppConfigService } from "../../config/app-config.service";
import { AiProviderException } from "../ai-provider.exception";
import { GenerateStructuredRequest } from "../interfaces/system-designer-ai-provider.interface";
import { GeminiProvider } from "./gemini.provider";
import {
  GeminiGenerateContentClient,
  GeminiGenerateContentResponse
} from "./gemini-provider.types";

describe("GeminiProvider", () => {
  const outputSchema = z.object({
    ok: z.boolean(),
    message: z.string()
  });

  type Output = z.infer<typeof outputSchema>;

  beforeEach(() => {
    vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createConfig(
    overrides: Partial<ConstructorParameters<typeof AppConfigService>[0]> = {}
  ) {
    const config: ConstructorParameters<typeof AppConfigService>[0] = {
      nodeEnv: "test",
      port: 3000,
      databaseUrl: "postgresql://postgres:postgres@localhost:5432/ai_system_design",
      appName: "AI System Design Copilot",
      appVersion: "0.1.0",
      corsOrigins: [],
      logLevel: "info",
      geminiApiKey: "test-gemini-key",
      geminiFastModel: "gemini-fast-test",
      geminiReasoningModel: "gemini-reasoning-test",
      geminiEmbeddingModel: "gemini-embedding-test",
      geminiEmbeddingModelVersion: "test-version",
      aiTimeoutMs: 1000,
      aiMaxRetries: 0,
      knowledgeChunkMaxTokens: 500,
      knowledgeEmbeddingDimensions: 32,
      knowledgeEmbeddingBatchSize: 4,
      retrievalDefaultTopK: 5,
      retrievalMinSimilarity: 0.2,
      interviewDailyLimit: 2,
      groqDeciderModel: "test-groq-model",
      livekitAgentName: "test-agent",
      judge0Url: "https://judge0.example.com",
      rapidApiKey: undefined,
      rapidApiHost: "judge0.example.com"
    };
    Object.assign(config, overrides);
    return new AppConfigService(config);
  }

  function createRequest(overrides: Partial<GenerateStructuredRequest<Output>> = {}) {
    return {
      operation: "test.operation",
      systemInstruction: "Return JSON only.",
      prompt: "Return { ok: true, message: 'done' }.",
      schema: outputSchema,
      modelClass: "fast" as const,
      ...overrides
    };
  }

  function createClient(
    generateContent: (params: GenerateContentParameters) => Promise<GeminiGenerateContentResponse>
  ): GeminiGenerateContentClient {
    return {
      models: {
        generateContent,
        embedContent: vi.fn()
      }
    };
  }

  it("selects the configured fast and reasoning models", async () => {
    const calls: GenerateContentParameters[] = [];
    const generateContent = vi.fn((params: GenerateContentParameters) => {
      calls.push(params);
      return Promise.resolve({ text: JSON.stringify({ ok: true, message: "done" }) });
    });
    const provider = new GeminiProvider(createConfig(), createClient(generateContent));

    await provider.generateStructured(createRequest({ modelClass: "fast" }));
    await provider.generateStructured(createRequest({ modelClass: "reasoning" }));

    expect(calls.map((call) => call.model)).toEqual(["gemini-fast-test", "gemini-reasoning-test"]);
    expect(calls[0]?.config).toMatchObject({
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: "object",
        required: ["ok", "message"]
      }
    });
  });

  it("sends a response schema stripped of the bounds Gemini rejects", async () => {
    // A schema carrying these keywords is refused with 400 INVALID_ARGUMENT
    // before the model reads anything, which is what broke resume onboarding.
    const boundedSchema = z.object({
      headline: z.string().min(4).max(140),
      confidence: z.number().min(0).max(1),
      skills: z.array(z.string().min(1).max(40)).max(16),
      entries: z.array(z.object({ quote: z.string().min(8).max(180) })).max(6)
    });
    const calls: GenerateContentParameters[] = [];
    const generateContent = vi.fn((params: GenerateContentParameters) => {
      calls.push(params);
      return Promise.resolve({
        text: JSON.stringify({ headline: "Engineer", confidence: 1, skills: [], entries: [] })
      });
    });
    const provider = new GeminiProvider(createConfig(), createClient(generateContent));

    await provider.generateStructured({
      operation: "test.bounded",
      systemInstruction: "Return JSON only.",
      prompt: "Return the object.",
      schema: boundedSchema,
      modelClass: "fast"
    });

    const serialised = JSON.stringify(calls[0]?.config?.responseJsonSchema);
    for (const keyword of [
      "minLength",
      "maxLength",
      "minItems",
      "maxItems",
      "minimum",
      "maximum"
    ]) {
      expect(serialised).not.toContain(keyword);
    }
    expect(calls[0]?.config?.responseJsonSchema).toMatchObject({
      type: "object",
      required: ["headline", "confidence", "skills", "entries"]
    });
  });

  it("honours a per-request timeout and attempt budget", async () => {
    const generateContent = vi.fn(() =>
      Promise.reject(Object.assign(new Error("temporarily unavailable"), { status: 503 }))
    );
    const provider = new GeminiProvider(
      createConfig({ aiMaxRetries: 5 }),
      createClient(generateContent)
    );

    await expect(
      provider.generateStructured(createRequest({ maxAttempts: 2, timeoutMs: 50 }))
    ).rejects.toMatchObject({ code: "AI_PROVIDER_ERROR" });
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("returns successful structured output validated with Zod", async () => {
    const generateContent = vi.fn(() =>
      Promise.resolve({
        text: JSON.stringify({ ok: true, message: "done" })
      })
    );
    const provider = new GeminiProvider(createConfig(), createClient(generateContent));

    await expect(provider.generateStructured(createRequest())).resolves.toEqual({
      ok: true,
      message: "done"
    });
  });

  it("sends inline documents as multimodal content", async () => {
    const generateContent = vi.fn(() =>
      Promise.resolve({ text: JSON.stringify({ ok: true, message: "done" }) })
    );
    const provider = new GeminiProvider(createConfig(), createClient(generateContent));

    await provider.generateStructured(
      createRequest({
        attachments: [{ mimeType: "application/pdf", data: "cGRm" }]
      })
    );

    expect(generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: "application/pdf", data: "cGRm" } },
              { text: "Return { ok: true, message: 'done' }." }
            ]
          }
        ]
      })
    );
  });

  it("maps invalid model output to a safe invalid response error", async () => {
    const generateContent = vi.fn(() =>
      Promise.resolve({
        text: JSON.stringify({ ok: true })
      })
    );
    const provider = new GeminiProvider(
      createConfig({ aiMaxRetries: 1 }),
      createClient(generateContent)
    );

    await expect(provider.generateStructured(createRequest())).rejects.toMatchObject({
      code: "AI_INVALID_RESPONSE",
      message: "AI provider returned output that did not match the expected schema",
      retryable: false
    });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("maps provider errors without exposing provider internals in the message", async () => {
    const providerError = new Error("raw provider message with prompt details");
    Object.assign(providerError, { status: 400 });
    const generateContent = vi.fn(() => Promise.reject(providerError));
    const provider = new GeminiProvider(
      createConfig({ aiMaxRetries: 1 }),
      createClient(generateContent)
    );

    await expect(provider.generateStructured(createRequest())).rejects.toMatchObject({
      code: "AI_PROVIDER_ERROR",
      message: "AI provider request failed",
      retryable: false
    });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("retries transient provider failures", async () => {
    const generateContent = vi
      .fn<(params: GenerateContentParameters) => Promise<GeminiGenerateContentResponse>>()
      .mockRejectedValueOnce({ status: 503, message: "temporarily unavailable" })
      .mockResolvedValueOnce({ text: JSON.stringify({ ok: true, message: "done" }) });
    const provider = new GeminiProvider(
      createConfig({ aiMaxRetries: 1 }),
      createClient(generateContent)
    );

    await expect(provider.generateStructured(createRequest())).resolves.toEqual({
      ok: true,
      message: "done"
    });
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("maps timeout behavior to a retryable timeout error", async () => {
    const generateContent = vi.fn(
      () => new Promise<GeminiGenerateContentResponse>(() => undefined)
    );
    const provider = new GeminiProvider(
      createConfig({ aiTimeoutMs: 100, aiMaxRetries: 0 }),
      createClient(generateContent)
    );

    await expect(provider.generateStructured(createRequest())).rejects.toBeInstanceOf(
      AiProviderException
    );
    await expect(provider.generateStructured(createRequest())).rejects.toMatchObject({
      code: "AI_TIMEOUT",
      message: "AI provider request timed out",
      retryable: true
    });
  });

  it("forwards caller cancellation to Gemini without retrying", async () => {
    const generateContent = vi.fn(
      (params: GenerateContentParameters) =>
        new Promise<GeminiGenerateContentResponse>((_resolve, reject) => {
          params.config?.abortSignal?.addEventListener("abort", () => {
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          });
        })
    );
    const provider = new GeminiProvider(
      createConfig({ aiMaxRetries: 3 }),
      createClient(generateContent)
    );
    const controller = new AbortController();
    const pending = provider.generateStructured(createRequest({ signal: controller.signal }));

    controller.abort();

    await expect(pending).rejects.toMatchObject({
      code: "AI_CANCELLED",
      message: "AI provider request was cancelled",
      retryable: false
    });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("aborts the Gemini SDK request when its timeout expires", async () => {
    let aborted = false;
    const generateContent = vi.fn(
      (params: GenerateContentParameters) =>
        new Promise<GeminiGenerateContentResponse>((_resolve, reject) => {
          params.config?.abortSignal?.addEventListener("abort", () => {
            aborted = true;
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          });
        })
    );
    const provider = new GeminiProvider(
      createConfig({ aiTimeoutMs: 20, aiMaxRetries: 0 }),
      createClient(generateContent)
    );

    await expect(provider.generateStructured(createRequest())).rejects.toMatchObject({
      code: "AI_TIMEOUT",
      retryable: true
    });
    expect(aborted).toBe(true);
  });
});
