import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { KnowledgeDocument } from "@prisma/client";
import { CreateKnowledgeDocumentDto } from "./dto/create-knowledge-document.dto";
import {
  EmbedKnowledgeDocumentResult,
  EmbeddingsService,
  RebuildKnowledgeEmbeddingsResult
} from "./embeddings.service";
import { KnowledgeEmbeddingStatusCounts } from "./knowledge.repository";
import { KnowledgeDocumentWithChunks } from "./knowledge.repository";
import { KnowledgeService } from "./knowledge.service";

@Controller({
  path: "knowledge/documents",
  version: "1"
})
export class KnowledgeController {
  constructor(
    private readonly knowledgeService: KnowledgeService,
    private readonly embeddingsService: EmbeddingsService
  ) {}

  @Post()
  createDocument(@Body() body: CreateKnowledgeDocumentDto): Promise<KnowledgeDocumentWithChunks> {
    return this.knowledgeService.createDocument(body);
  }

  @Get()
  listDocuments(): Promise<KnowledgeDocument[]> {
    return this.knowledgeService.listDocuments();
  }

  @Get(":id")
  getDocument(@Param("id", ParseUUIDPipe) id: string): Promise<KnowledgeDocumentWithChunks> {
    return this.knowledgeService.getDocument(id);
  }

  @Delete(":id")
  deleteDocument(@Param("id", ParseUUIDPipe) id: string): Promise<KnowledgeDocument> {
    return this.knowledgeService.deleteDocument(id);
  }

  @Post(":id/embed")
  embedDocument(@Param("id", ParseUUIDPipe) id: string): Promise<EmbedKnowledgeDocumentResult> {
    return this.embeddingsService.embedDocument(id);
  }
}

@Controller({
  path: "knowledge/embeddings",
  version: "1"
})
export class KnowledgeEmbeddingsController {
  constructor(private readonly embeddingsService: EmbeddingsService) {}

  @Post("rebuild")
  rebuildEmbeddings(): Promise<RebuildKnowledgeEmbeddingsResult> {
    return this.embeddingsService.rebuildEmbeddings();
  }

  @Get("status")
  getStatus(): Promise<KnowledgeEmbeddingStatusCounts> {
    return this.embeddingsService.getStatus();
  }
}
