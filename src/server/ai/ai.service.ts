import type {
  GenerateStructuredRequest,
  SystemDesignerAIProvider
} from "./interfaces/system-designer-ai-provider.interface";

export class AiService {
  constructor(private readonly provider: SystemDesignerAIProvider) {}

  generateStructured<T>(request: GenerateStructuredRequest<T>): Promise<T> {
    return this.provider.generateStructured(request);
  }
}
