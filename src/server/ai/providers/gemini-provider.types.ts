import type { EmbedContentParameters, GenerateContentParameters } from "@google/genai";

export interface GeminiGenerateContentResponse {
  readonly text?: string;
  /** Token counts for pricing; thinking tokens are billed as output. */
  readonly usageMetadata?: {
    readonly promptTokenCount?: number;
    readonly candidatesTokenCount?: number;
    readonly thoughtsTokenCount?: number;
  };
}

export interface GeminiGenerateContentClient {
  readonly models: {
    generateContent(params: GenerateContentParameters): Promise<GeminiGenerateContentResponse>;
    embedContent(params: EmbedContentParameters): Promise<GeminiEmbedContentResponse>;
  };
}

export interface GeminiEmbedContentResponse {
  readonly embeddings?: ReadonlyArray<{
    readonly values?: number[];
  }>;
}
