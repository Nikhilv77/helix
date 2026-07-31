export interface GenerateEmbeddingsRequest {
  operation: string;
  texts: string[];
}

export interface GenerateEmbeddingsResult {
  embeddings: number[][];
  model: string;
  modelVersion: string;
}

export interface EmbeddingsProvider {
  generateEmbeddings(request: GenerateEmbeddingsRequest): Promise<GenerateEmbeddingsResult>;
}
