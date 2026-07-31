import { z } from "zod";
import { AiService } from "./ai.service";
import { SystemDesignerAIProvider } from "./interfaces/system-designer-ai-provider.interface";

describe("AiService", () => {
  it("delegates structured generation to the configured provider", async () => {
    const schema = z.object({ ok: z.boolean() });
    const generateStructured = jest.fn().mockResolvedValue({ ok: true });
    const provider: SystemDesignerAIProvider = { generateStructured };
    const service = new AiService(provider);
    const request = {
      operation: "test.operation",
      systemInstruction: "Return JSON only.",
      prompt: "Return ok.",
      schema,
      modelClass: "fast" as const
    };

    await expect(service.generateStructured(request)).resolves.toEqual({ ok: true });
    expect(generateStructured).toHaveBeenCalledWith(request);
  });
});
