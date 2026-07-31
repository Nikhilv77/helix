import "dotenv/config";
import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AiModule } from "../ai.module";
import { AiService } from "../ai.service";
import { internalStructuredOutputTestSchema } from "./internal-test.schema";

async function main(): Promise<void> {
  const logger = new Logger("AiStructuredOutputVerifier");
  const app = await NestFactory.createApplicationContext(AiModule, {
    logger: ["log", "warn", "error"]
  });

  try {
    const aiService = app.get(AiService);
    const result = await aiService.generateStructured({
      operation: "dev.structured_output_check",
      systemInstruction:
        "Return only valid JSON matching the requested schema. Do not include markdown.",
      prompt:
        "Return a tiny JSON object confirming structured output works with ok=true, a short summary, and two checklist items.",
      schema: internalStructuredOutputTestSchema,
      modelClass: "fast",
      temperature: 0
    });

    logger.log(JSON.stringify({ event: "ai.dev.structured_output.success", result }));
  } finally {
    await app.close();
  }
}

void main();
