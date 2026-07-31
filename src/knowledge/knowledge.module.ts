import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { EmbeddingsService } from "./embeddings.service";
import { KnowledgeController, KnowledgeEmbeddingsController } from "./knowledge.controller";
import { KnowledgeRepository } from "./knowledge.repository";
import { KnowledgeService } from "./knowledge.service";

@Module({
  imports: [AiModule],
  controllers: [KnowledgeController, KnowledgeEmbeddingsController],
  providers: [KnowledgeRepository, KnowledgeService, EmbeddingsService],
  exports: [KnowledgeService]
})
export class KnowledgeModule {}
