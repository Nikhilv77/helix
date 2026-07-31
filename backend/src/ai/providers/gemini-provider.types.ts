import type { EmbedContentParameters, GenerateContentParameters } from "@google/genai";

export interface GeminiGenerateContentResponse {
  readonly text?: string;
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
