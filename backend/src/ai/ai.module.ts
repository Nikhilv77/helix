import { Module } from "@nestjs/common";
import { GoogleGenAI } from "@google/genai";
import { ConfigModule } from "../config/config.module";
import { AppConfigService } from "../config/app-config.service";
import { AiService } from "./ai.service";
import { GeminiEmbeddingsProvider } from "./providers/gemini-embeddings.provider";
import { GeminiProvider } from "./providers/gemini.provider";
import type { GeminiGenerateContentClient } from "./providers/gemini-provider.types";
import { EMBEDDINGS_PROVIDER } from "./tokens/embeddings-provider.token";
import { SYSTEM_DESIGNER_AI_PROVIDER } from "./tokens/ai-provider.token";
import { GEMINI_CLIENT } from "./tokens/gemini-client.token";

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: GEMINI_CLIENT,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): GeminiGenerateContentClient =>
        new GoogleGenAI({ apiKey: config.geminiApiKey })
    },
    GeminiProvider,
    GeminiEmbeddingsProvider,
    {
      provide: SYSTEM_DESIGNER_AI_PROVIDER,
      useExisting: GeminiProvider
    },
    {
      provide: EMBEDDINGS_PROVIDER,
      useExisting: GeminiEmbeddingsProvider
    },
    AiService
  ],
  exports: [AiService, SYSTEM_DESIGNER_AI_PROVIDER, EMBEDDINGS_PROVIDER]
})
export class AiModule {}
