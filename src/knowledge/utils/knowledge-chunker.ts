import { KnowledgeSourceType, Prisma } from "@prisma/client";
import { createContentHash } from "./content-hash";
import { estimateTokens } from "./token-estimator";

export interface KnowledgeChunkInput {
  sourceTitle: string;
  sourceType: KnowledgeSourceType;
  content: string;
  maxTokens: number;
}

export interface PreparedKnowledgeChunk {
  content: string;
  contentHash: string;
  chunkIndex: number;
  tokenEstimate: number;
  metadata: Prisma.JsonObject;
}

interface SectionBlock {
  content: string;
  headingPath: string[];
  sectionIndex: number;
}

export function chunkKnowledgeDocument(input: KnowledgeChunkInput): PreparedKnowledgeChunk[] {
  const sections = splitIntoSections(input.content, input.sourceType);
  const chunks: PreparedKnowledgeChunk[] = [];

  for (const section of sections) {
    const paragraphs = splitIntoParagraphs(section.content);
    const pendingParagraphs: string[] = [];

    for (const paragraph of paragraphs) {
      const paragraphParts = splitOversizedParagraph(paragraph, input.maxTokens);

      for (const part of paragraphParts) {
        const nextContent = [...pendingParagraphs, part].join("\n\n");

        if (pendingParagraphs.length > 0 && estimateTokens(nextContent) > input.maxTokens) {
          chunks.push(createChunk(chunks.length, pendingParagraphs.join("\n\n"), input, section));
          pendingParagraphs.length = 0;
        }

        pendingParagraphs.push(part);
      }
    }

    if (pendingParagraphs.length > 0) {
      chunks.push(createChunk(chunks.length, pendingParagraphs.join("\n\n"), input, section));
    }
  }

  return chunks;
}

function splitIntoSections(content: string, sourceType: KnowledgeSourceType): SectionBlock[] {
  if (sourceType !== KnowledgeSourceType.MARKDOWN) {
    return [{ content, headingPath: [], sectionIndex: 0 }];
  }

  const sections: SectionBlock[] = [];
  const headingStack: string[] = [];
  let currentLines: string[] = [];
  let currentHeadingPath: string[] = [];

  for (const line of content.split("\n")) {
    const heading = parseMarkdownHeading(line);

    if (heading) {
      if (currentLines.some((entry) => entry.trim().length > 0)) {
        sections.push({
          content: currentLines.join("\n").trim(),
          headingPath: currentHeadingPath,
          sectionIndex: sections.length
        });
      }

      headingStack.length = heading.level - 1;
      headingStack[heading.level - 1] = heading.title;
      currentHeadingPath = headingStack.filter((entry): entry is string => Boolean(entry));
      currentLines = [line];
      continue;
    }

    currentLines.push(line);
  }

  if (currentLines.some((entry) => entry.trim().length > 0)) {
    sections.push({
      content: currentLines.join("\n").trim(),
      headingPath: currentHeadingPath,
      sectionIndex: sections.length
    });
  }

  return sections.length > 0 ? sections : [{ content, headingPath: [], sectionIndex: 0 }];
}

function parseMarkdownHeading(line: string): { level: number; title: string } | undefined {
  const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);

  if (!match) {
    return undefined;
  }

  const marker = match[1];
  const title = match[2];

  if (!marker || !title) {
    return undefined;
  }

  return {
    level: marker.length,
    title
  };
}

function splitIntoParagraphs(content: string): string[] {
  return content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

function splitOversizedParagraph(paragraph: string, maxTokens: number): string[] {
  if (estimateTokens(paragraph) <= maxTokens) {
    return [paragraph];
  }

  const sentences = paragraph
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length > 1) {
    return packUnits(sentences, maxTokens);
  }

  return packUnits(paragraph.split(/\s+/), maxTokens);
}

function packUnits(units: string[], maxTokens: number): string[] {
  const chunks: string[] = [];
  const pending: string[] = [];

  for (const unit of units) {
    const next = [...pending, unit].join(" ");

    if (pending.length > 0 && estimateTokens(next) > maxTokens) {
      chunks.push(pending.join(" "));
      pending.length = 0;
    }

    pending.push(unit);
  }

  if (pending.length > 0) {
    chunks.push(pending.join(" "));
  }

  return chunks;
}

function createChunk(
  chunkIndex: number,
  content: string,
  input: KnowledgeChunkInput,
  section: SectionBlock
): PreparedKnowledgeChunk {
  return {
    content,
    contentHash: createContentHash(content),
    chunkIndex,
    tokenEstimate: estimateTokens(content),
    metadata: {
      headingPath: section.headingPath,
      sourceTitle: input.sourceTitle,
      sourceType: input.sourceType,
      sectionIndex: section.sectionIndex
    }
  };
}
