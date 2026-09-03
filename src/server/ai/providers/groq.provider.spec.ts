import { z } from "zod";
import { AppConfigService } from "../../config/app-config.service";
import { GenerateStructuredRequest } from "../interfaces/system-designer-ai-provider.interface";
import { GroqProvider } from "./groq.provider";

describe("GroqProvider", () => {
  const outputSchema = z.object({ ok: z.boolean() });
  type Output = z.infer<typeof outputSchema>;

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function createConfig(
    overrides: Partial<ConstructorParameters<typeof AppConfigService>[0]> = {}
  ) {
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
      interviewDailyLimit: 2,
      groqDeciderModel: "test-groq-model",
      livekitAgentName: "test-agent",
      judge0Url: "https://judge0.example.com",
      rapidApiKey: undefined,
      rapidApiHost: "judge0.example.com",
      ...overrides
    });
  }

  function createRequest(overrides: Partial<GenerateStructuredRequest<Output>> = {}) {
    return {
      operation: "test.operation",
      systemInstruction: "Return JSON only.",
      prompt: "Return { ok: true }.",
      schema: outputSchema,
      modelClass: "fast" as const,
      ...overrides
    };
  }

  it("returns validated structured output", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] })
    });
    vi.stubGlobal("fetch", fetchMock);
    const provider = new GroqProvider(createConfig(), "test-key", "test-model");

    await expect(provider.generateStructured(createRequest())).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps caller abort to AI_CANCELLED without retrying", async () => {
    let aborted = false;
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            aborted = true;
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          });
        })
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new GroqProvider(createConfig({ aiMaxRetries: 3 }), "test-key", "test-model");
    const controller = new AbortController();
    const pending = provider.generateStructured(createRequest({ signal: controller.signal }));

    controller.abort();

    await expect(pending).rejects.toMatchObject({ code: "AI_CANCELLED", retryable: false });
    expect(aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps timeout to AI_TIMEOUT and aborts the underlying fetch signal", async () => {
    let aborted = false;
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            aborted = true;
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          });
        })
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new GroqProvider(
      createConfig({ aiTimeoutMs: 20, aiMaxRetries: 0 }),
      "test-key",
      "test-model"
    );

    await expect(provider.generateStructured(createRequest())).rejects.toMatchObject({
      code: "AI_TIMEOUT",
      retryable: true
    });
    expect(aborted).toBe(true);
  });
});
