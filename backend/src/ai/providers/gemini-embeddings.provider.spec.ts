import { Logger } from "@nestjs/common";
import { EmbedContentParameters, GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import { AppConfigService } from "../../config/app-config.service";
import { GeminiEmbeddingsProvider } from "./gemini-embeddings.provider";
import { GeminiGenerateContentClient } from "./gemini-provider.types";

describe("GeminiEmbeddingsProvider", () => {
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
      knowledgeEmbeddingDimensions: 4,
      knowledgeEmbeddingBatchSize: 2,
      retrievalDefaultTopK: 5,
      retrievalMinSimilarity: 0.2,
      ...overrides
    });
  }

  function createClient(
    embedContent: (params: EmbedContentParameters) => Promise<{ embeddings?: Array<{ values?: number[] }> }>
  ): GeminiGenerateContentClient {
    const generateContent = jest.fn<Promise<GenerateContentResponse>, [GenerateContentParameters]>();

    return {
      models: {
        generateContent,
        embedContent
      }
    };
  }

  it("returns embeddings with configured model metadata", async () => {
    const embedContent = jest.fn(() =>
      Promise.resolve({
        embeddings: [{ values: [0.1, 0.2, 0.3, 0.4] }]
      })
    );
    const provider = new GeminiEmbeddingsProvider(createConfig(), createClient(embedContent));

    await expect(
      provider.generateEmbeddings({
        operation: "test.embed",
        texts: ["hello"]
      })
    ).resolves.toEqual({
      embeddings: [[0.1, 0.2, 0.3, 0.4]],
      model: "gemini-embedding-test",
      modelVersion: "test-version"
    });
    expect(embedContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-embedding-test",
        contents: ["hello"]
      })
    );
  });

  it("retries transient embedding provider failures", async () => {
    const providerError = new Error("temporarily unavailable");
    Object.assign(providerError, { status: 503 });
    const embedContent = jest
      .fn<Promise<{ embeddings?: Array<{ values?: number[] }> }>, [EmbedContentParameters]>()
      .mockRejectedValueOnce(providerError)
      .mockResolvedValueOnce({ embeddings: [{ values: [0.1, 0.2, 0.3, 0.4] }] });
    const provider = new GeminiEmbeddingsProvider(
      createConfig({ aiMaxRetries: 1 }),
      createClient(embedContent)
    );

    await expect(
      provider.generateEmbeddings({
        operation: "test.embed",
        texts: ["hello"]
      })
    ).resolves.toMatchObject({
      embeddings: [[0.1, 0.2, 0.3, 0.4]]
    });
    expect(embedContent).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid embedding responses", async () => {
    const embedContent = jest.fn(() => Promise.resolve({ embeddings: [{ values: [] }] }));
    const provider = new GeminiEmbeddingsProvider(createConfig(), createClient(embedContent));

    await expect(
      provider.generateEmbeddings({
        operation: "test.embed",
        texts: ["hello"]
      })
    ).rejects.toMatchObject({
      code: "AI_INVALID_EMBEDDING_RESPONSE",
      retryable: false
    });
  });
});
