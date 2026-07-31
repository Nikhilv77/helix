import { Logger } from "../../common/logger";
import { GenerateContentParameters } from "@google/genai";
import { z } from "zod";
import { AppConfigService } from "../../config/app-config.service";
import { AiProviderException } from "../ai-provider.exception";
import { GenerateStructuredRequest } from "../interfaces/system-designer-ai-provider.interface";
import { GeminiProvider } from "./gemini.provider";
import { GeminiGenerateContentClient, GeminiGenerateContentResponse } from "./gemini-provider.types";

describe("GeminiProvider", () => {
  const outputSchema = z.object({
    ok: z.boolean(),
    message: z.string()
  });

  type Output = z.infer<typeof outputSchema>;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createConfig(overrides: Partial<ConstructorParameters<typeof AppConfigService>[0]> = {}) {
    return new AppConfigService({
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
      ...overrides
    });
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
        embedContent: jest.fn()
      }
    };
  }

  it("selects the configured fast and reasoning models", async () => {
    const calls: GenerateContentParameters[] = [];
    const generateContent = jest.fn((params: GenerateContentParameters) => {
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

  it("returns successful structured output validated with Zod", async () => {
    const generateContent = jest.fn(() =>
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

  it("maps invalid model output to a safe invalid response error", async () => {
    const generateContent = jest.fn(() =>
      Promise.resolve({
        text: JSON.stringify({ ok: true })
      })
    );
    const provider = new GeminiProvider(createConfig({ aiMaxRetries: 1 }), createClient(generateContent));

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
    const generateContent = jest.fn(() => Promise.reject(providerError));
    const provider = new GeminiProvider(createConfig({ aiMaxRetries: 1 }), createClient(generateContent));

    await expect(provider.generateStructured(createRequest())).rejects.toMatchObject({
      code: "AI_PROVIDER_ERROR",
      message: "AI provider request failed",
      retryable: false
    });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("retries transient provider failures", async () => {
    const generateContent = jest
      .fn<Promise<GeminiGenerateContentResponse>, [GenerateContentParameters]>()
      .mockRejectedValueOnce({ status: 503, message: "temporarily unavailable" })
      .mockResolvedValueOnce({ text: JSON.stringify({ ok: true, message: "done" }) });
    const provider = new GeminiProvider(createConfig({ aiMaxRetries: 1 }), createClient(generateContent));

    await expect(provider.generateStructured(createRequest())).resolves.toEqual({
      ok: true,
      message: "done"
    });
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("maps timeout behavior to a retryable timeout error", async () => {
    const generateContent = jest.fn(
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
});
