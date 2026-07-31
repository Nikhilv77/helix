import { Injectable } from "@nestjs/common";
import { KnowledgeDocument } from "@prisma/client";
import { ConflictErrorException } from "../common/exceptions/conflict-error.exception";
import { NotFoundErrorException } from "../common/exceptions/not-found-error.exception";
import { AppConfigService } from "../config/app-config.service";
import { CreateKnowledgeDocumentDto } from "./dto/create-knowledge-document.dto";
import { KnowledgeDocumentWithChunks, KnowledgeRepository } from "./knowledge.repository";
import { createContentHash } from "./utils/content-hash";
import { chunkKnowledgeDocument } from "./utils/knowledge-chunker";
import { normalizeKnowledgeText } from "./utils/text-normalizer";

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly config: AppConfigService,
    private readonly knowledgeRepository: KnowledgeRepository
  ) {}

  async createDocument(input: CreateKnowledgeDocumentDto): Promise<KnowledgeDocumentWithChunks> {
    const normalizedContent = normalizeKnowledgeText(input.content);
    const contentHash = createContentHash(normalizedContent);
    const existingDocument = await this.knowledgeRepository.findByContentHash(contentHash);

    if (existingDocument) {
      throw new ConflictErrorException(
        "KNOWLEDGE_DOCUMENT_DUPLICATE",
        "A knowledge document with the same normalized content already exists",
        { documentId: existingDocument.id }
      );
    }

    const document = await this.createPendingDocument(input, contentHash);

    try {
      await this.knowledgeRepository.startProcessing(document.id);
      const chunks = chunkKnowledgeDocument({
        sourceTitle: input.title,
        sourceType: input.sourceType,
        content: normalizedContent,
        maxTokens: this.config.knowledgeChunkMaxTokens
      });

      if (chunks.length === 0) {
        throw new Error("No knowledge chunks were produced");
      }

      return await this.knowledgeRepository.completeDocument(document.id, chunks);
    } catch (error) {
      await this.knowledgeRepository.failDocument(
        document.id,
        "Knowledge document ingestion failed"
      );
      throw error;
    }
  }

  listDocuments(): Promise<KnowledgeDocument[]> {
    return this.knowledgeRepository.listDocuments();
  }

  async getDocument(id: string): Promise<KnowledgeDocumentWithChunks> {
    const document = await this.knowledgeRepository.findDocumentById(id);

    if (!document) {
      throw new NotFoundErrorException("KNOWLEDGE_DOCUMENT_NOT_FOUND", "Knowledge document not found", {
        documentId: id
      });
    }

    return document;
  }

  async deleteDocument(id: string): Promise<KnowledgeDocument> {
    await this.getDocument(id);
    return this.knowledgeRepository.deleteDocument(id);
  }

  private async createPendingDocument(
    input: CreateKnowledgeDocumentDto,
    contentHash: string
  ): Promise<KnowledgeDocument> {
    try {
      return await this.knowledgeRepository.createPendingDocument({
        title: input.title,
        sourceType: input.sourceType,
        sourceUrl: input.sourceUrl,
        contentHash
      });
    } catch (error) {
      if (this.knowledgeRepository.isUniqueConstraintError(error)) {
        throw new ConflictErrorException(
          "KNOWLEDGE_DOCUMENT_DUPLICATE",
          "A knowledge document with the same normalized content already exists"
        );
      }

      throw error;
    }
  }
}
