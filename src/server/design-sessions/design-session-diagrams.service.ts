import { DesignSession } from "@prisma/client";
import { AiProviderException } from "../ai/ai-provider.exception";
import { AiService } from "../ai/ai.service";
import { Logger } from "../common/logger";
import { ConflictErrorException } from "../common/exceptions/conflict-error.exception";
import { NotFoundErrorException } from "../common/exceptions/not-found-error.exception";
import {
  ArchitectureDiagram,
  architectureDiagramAiOutputSchema,
  architectureDiagramSchema
} from "./architecture-diagram.schema";
import { DesignSessionsRepository } from "./design-sessions.repository";
import { MermaidFlowchartValidator } from "./mermaid-flowchart.validator";
import { GeneratedSystemDesign, generatedSystemDesignSchema } from "./system-design.schema";

interface DiagramResponse {
  designSessionId: string;
  diagram: ArchitectureDiagram | null;
  generatedAt: Date | null;
}

export class DesignSessionDiagramsService {
  private readonly logger = new Logger(DesignSessionDiagramsService.name);

  constructor(
    private readonly designSessionsRepository: DesignSessionsRepository,
    private readonly aiService: AiService,
    private readonly mermaidFlowchartValidator: MermaidFlowchartValidator
  ) {}

  async generateDiagram(id: string, ownerId?: string): Promise<DiagramResponse> {
    const session = await this.getExistingDesignSession(id, ownerId);
    const design = this.requireGeneratedDesign(session);

    try {
      this.logger.log({
        event: "diagram_generation_started",
        designSessionId: session.id,
        componentCount: design.majorComponents.length
      });

      const output = await this.aiService.generateStructured({
        operation: "architecture_diagram.generation",
        systemInstruction: this.buildDiagramSystemInstruction(),
        prompt: this.buildDiagramPrompt(design),
        schema: architectureDiagramAiOutputSchema,
        modelClass: "fast",
        temperature: 0
      });
      const mermaid = this.validateOrBuildFallback(output.mermaid, design);
      const diagram: ArchitectureDiagram = {
        type: "flowchart",
        direction: "TD",
        mermaid,
        generatedAt: new Date().toISOString()
      };
      const updatedSession = await this.designSessionsRepository.saveArchitectureDiagram(
        session.id,
        diagram
      );

      this.logger.log({
        event: "diagram_generation_completed",
        designSessionId: session.id,
        lineCount: mermaid.split("\n").length
      });

      return {
        designSessionId: updatedSession.id,
        diagram,
        generatedAt: updatedSession.diagramGeneratedAt
      };
    } catch (error: unknown) {
      if (error instanceof ConflictErrorException || error instanceof NotFoundErrorException) {
        throw error;
      }

      if (error instanceof AiProviderException) {
        this.logger.warn({
          event: "diagram_generation_fallback_used",
          designSessionId: session.id,
          failureCode: error.code
        });

        const fallbackMermaid = this.mermaidFlowchartValidator.validate(
          this.buildFallbackMermaid(design)
        );
        const diagram: ArchitectureDiagram = {
          type: "flowchart",
          direction: "TD",
          mermaid: fallbackMermaid,
          generatedAt: new Date().toISOString()
        };
        const updatedSession = await this.designSessionsRepository.saveArchitectureDiagram(
          session.id,
          diagram
        );

        return {
          designSessionId: updatedSession.id,
          diagram,
          generatedAt: updatedSession.diagramGeneratedAt
        };
      }

      throw error;
    }
  }

  async getDiagram(id: string, ownerId?: string): Promise<DiagramResponse> {
    const session = await this.getExistingDesignSession(id, ownerId);

    return {
      designSessionId: session.id,
      diagram: this.parseStoredDiagram(session.architectureDiagram),
      generatedAt: session.diagramGeneratedAt
    };
  }

  private async getExistingDesignSession(id: string, ownerId?: string): Promise<DesignSession> {
    const session = await this.designSessionsRepository.findById(id, ownerId);

    if (!session) {
      throw new NotFoundErrorException("DESIGN_SESSION_NOT_FOUND", "Design session not found", {
        designSessionId: id
      });
    }

    return session;
  }

  private requireGeneratedDesign(session: DesignSession): GeneratedSystemDesign {
    const result = generatedSystemDesignSchema.safeParse(session.generatedDesign);

    if (!result.success) {
      throw new ConflictErrorException(
        "GENERATED_DESIGN_REQUIRED",
        "A generated system design is required before creating an architecture diagram",
        { designSessionId: session.id }
      );
    }

    return result.data;
  }

  private parseStoredDiagram(value: unknown): ArchitectureDiagram | null {
    if (value === null) {
      return null;
    }

    const result = architectureDiagramSchema.safeParse(value);
    return result.success ? result.data : null;
  }

  private buildDiagramSystemInstruction(): string {
    return [
      "Generate a Mermaid architecture diagram for a completed system design.",
      "Return only structured JSON matching the schema.",
      "The mermaid field must contain only a Mermaid flowchart using flowchart TD.",
      "Use only these edge operators: -->, -- label -->, ---, -- label ---, -.->, and ==>. Do not use <--> or any edge starting with <.",
      "Prefer layered subgraph blocks for client, ingress, processing, data, and operations layers.",
      "Include clients, services, databases, caches, queues, and external systems when relevant.",
      "Show the main request, write, read, async, and notification paths instead of a single hub-and-spoke fan-out.",
      "Keep the diagram readable and avoid excessive nodes.",
      "Do not use Mermaid directives, click actions, href actions, scripts, custom classes, or styles."
    ].join(" ");
  }

  private buildDiagramPrompt(design: GeneratedSystemDesign): string {
    return JSON.stringify({
      design,
      constraints: {
        mermaidType: "flowchart",
        direction: "TD",
        maxNodes: 18,
        layout:
          "Use safe subgraph blocks for Client, Ingress, Processing, Data, and Operations layers",
        avoid: ["directives", "click", "href", "classDef", "style", "scripts", "<-->"]
      }
    });
  }

  private sanitizeMermaid(mermaid: string): string {
    return mermaid
      .replace(/<-->/g, "-->")
      .replace(/<--/g, "-->")
      .replace(/([A-Za-z][A-Za-z0-9_-]*)\[\("([^"]+)"\)\]/g, "$1[($2)]")
      .split("\n")
      .map((line) =>
        line.replace(/--\s*(.+?)\s*-->/g, (_match, label: string) => {
          const safeLabel = label.replace(/-/g, " to ");
          return `-- ${safeLabel} -->`;
        })
      )
      .join("\n");
  }

  private validateOrBuildFallback(mermaid: string, design: GeneratedSystemDesign): string {
    try {
      return this.mermaidFlowchartValidator.validate(this.sanitizeMermaid(mermaid));
    } catch (error) {
      this.logger.warn({
        event: "diagram_generation_ai_output_invalid",
        reason: error instanceof Error ? error.message : "Unknown Mermaid validation error"
      });

      return this.mermaidFlowchartValidator.validate(this.buildFallbackMermaid(design));
    }
  }

  private buildFallbackMermaid(design: GeneratedSystemDesign): string {
    const componentNames = design.majorComponents.map((component) =>
      this.safeMermaidLabel(component.name)
    );
    const ingress = this.findComponentLabel(
      componentNames,
      ["gateway", "ingest", "scraper", "api"],
      "API Gateway"
    );
    const processor = this.findComponentLabel(
      componentNames,
      ["process", "worker", "engine", "downsample", "aggregate"],
      "Processing Workers"
    );
    const query = this.findComponentLabel(
      componentNames,
      ["query", "visual", "dashboard", "read"],
      "Query and Dashboard Service"
    );
    const alerting = this.findComponentLabel(
      componentNames,
      ["alert", "notification"],
      "Alerting Service"
    );
    const queue = this.findRecommendationLabel(
      design.messagingAndAsyncProcessing.map((item) => item.name),
      "Message Queue"
    );
    const database = this.findRecommendationLabel(
      design.databaseChoices.map((item) => item.name),
      "Primary Data Store"
    );
    const cache = this.findRecommendationLabel(
      design.cachingStrategy.map((item) => item.name),
      "Cache"
    );
    const storage = this.findRecommendationLabel(
      design.storageStrategy.map((item) => item.name),
      "Object Storage"
    );

    return [
      "flowchart TD",
      "  subgraph ClientLayer[Client Layer]",
      "    Users[Users and Operators]",
      "    Producers[Agents and External Producers]",
      "  end",
      "  subgraph IngressLayer[Ingress Layer]",
      `    Gateway[${ingress}]`,
      "    Auth[Auth and Rate Limits]",
      "  end",
      "  subgraph ProcessingLayer[Processing Layer]",
      `    Queue[${queue}]`,
      `    Processor[${processor}]`,
      `    Alerting[${alerting}]`,
      "  end",
      "  subgraph DataLayer[Data Layer]",
      `    Store[(${database})]`,
      `    Cache[(${cache})]`,
      `    Archive[(${storage})]`,
      "  end",
      "  subgraph ExperienceLayer[Experience Layer]",
      `    Query[${query}]`,
      "    Notifications[Notification Channels]",
      "  end",
      "  Users --> Gateway",
      "  Producers --> Gateway",
      "  Gateway --> Auth",
      "  Auth --> Queue",
      "  Queue --> Processor",
      "  Processor --> Store",
      "  Processor --> Archive",
      "  Processor --> Alerting",
      "  Alerting --> Notifications",
      "  Users --> Query",
      "  Query --> Cache",
      "  Query --> Store"
    ].join("\n");
  }

  private safeMermaidLabel(label: string): string {
    return (
      label
        .replace(/[[\]{}()<>"]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80) || "Component"
    );
  }

  private findComponentLabel(labels: string[], keywords: string[], fallback: string): string {
    const match = labels.find((label) => {
      const normalized = label.toLowerCase();
      return keywords.some((keyword) => normalized.includes(keyword));
    });

    return match ?? fallback;
  }

  private findRecommendationLabel(labels: string[], fallback: string): string {
    const match = labels.find((label) => label.trim().length > 0);
    return match ? this.safeMermaidLabel(match) : fallback;
  }
}
