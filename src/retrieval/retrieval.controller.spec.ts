import { KnowledgeSourceType } from "@prisma/client";
import { RetrievalController } from "./retrieval.controller";
import { RetrievalService } from "./retrieval.service";

describe("RetrievalController", () => {
  it("delegates search requests to the retrieval service", async () => {
    const search = jest.fn().mockResolvedValue({
      query: "retry queues",
      results: [],
      meta: {
        topK: 5,
        minSimilarity: 0.2,
        returned: 0,
        scanned: 0
      }
    });
    const controller = new RetrievalController({ search } as unknown as RetrievalService);
    const request = {
      query: "retry queues",
      topK: 5,
      sourceType: KnowledgeSourceType.MARKDOWN
    };

    await expect(controller.search(request)).resolves.toMatchObject({
      query: "retry queues"
    });
    expect(search).toHaveBeenCalledWith(request);
  });
});
