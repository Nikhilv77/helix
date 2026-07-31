import { Inject, Injectable } from "@nestjs/common";
import type {
  GenerateStructuredRequest,
  SystemDesignerAIProvider
} from "./interfaces/system-designer-ai-provider.interface";
import { SYSTEM_DESIGNER_AI_PROVIDER } from "./tokens/ai-provider.token";

@Injectable()
export class AiService {
  constructor(
    @Inject(SYSTEM_DESIGNER_AI_PROVIDER)
    private readonly provider: SystemDesignerAIProvider
  ) {}

  generateStructured<T>(request: GenerateStructuredRequest<T>): Promise<T> {
    return this.provider.generateStructured(request);
  }
}
