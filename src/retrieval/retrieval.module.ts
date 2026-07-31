import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { RetrievalController } from "./retrieval.controller";
import { RetrievalRepository } from "./retrieval.repository";
import { RetrievalService } from "./retrieval.service";

@Module({
  imports: [AiModule],
  controllers: [RetrievalController],
  providers: [RetrievalRepository, RetrievalService],
  exports: [RetrievalService]
})
export class RetrievalModule {}
