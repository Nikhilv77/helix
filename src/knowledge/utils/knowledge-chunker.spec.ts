import { KnowledgeSourceType } from "@prisma/client";
import { chunkKnowledgeDocument } from "./knowledge-chunker";

describe("chunkKnowledgeDocument", () => {
  it("creates heading-aware chunks for markdown documents", () => {
    const chunks = chunkKnowledgeDocument({
      sourceTitle: "Caching Strategies",
      sourceType: KnowledgeSourceType.MARKDOWN,
      maxTokens: 40,
      content: `# Caching

Caching avoids repeated reads.

## Cache Aside

Read cache first. Load from storage on misses.

## Invalidation

Expire keys and publish invalidation events.`
    });

    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks[0]?.metadata).toMatchObject({
      headingPath: ["Caching"],
      sourceTitle: "Caching Strategies",
      sourceType: KnowledgeSourceType.MARKDOWN
    });
    expect(chunks.some((chunk) => headingPathIncludes(chunk.metadata.headingPath, "Cache Aside"))).toBe(
      true
    );
    expect(
      chunks.some((chunk) => headingPathIncludes(chunk.metadata.headingPath, "Invalidation"))
    ).toBe(true);
  });

  it("respects configured chunk size using paragraph boundaries where possible", () => {
    const chunks = chunkKnowledgeDocument({
      sourceTitle: "Queues",
      sourceType: KnowledgeSourceType.PLAIN_TEXT,
      maxTokens: 12,
      content: `Queues decouple producers from consumers.

They smooth bursts and allow retries.

Consumers should be idempotent and observable.`
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.tokenEstimate <= 12)).toBe(true);
  });
});

function headingPathIncludes(value: unknown, heading: string): boolean {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
    ? value.includes(heading)
    : false;
}
