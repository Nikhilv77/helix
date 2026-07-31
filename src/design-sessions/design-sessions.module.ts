import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { ProjectsModule } from "../projects/projects.module";
import { RetrievalModule } from "../retrieval/retrieval.module";
import { ToolsModule } from "../tools/tools.module";
import {
  DesignSessionsController,
  ProjectDesignSessionsController
} from "./design-sessions.controller";
import { DesignSessionDiagramsService } from "./design-session-diagrams.service";
import { DesignValidationService } from "./design-validation.service";
import { DesignSessionsRepository } from "./design-sessions.repository";
import { DesignSessionsService } from "./design-sessions.service";
import { DeterministicDesignValidatorService } from "./deterministic-design-validator.service";
import { MermaidFlowchartValidator } from "./mermaid-flowchart.validator";

@Module({
  imports: [AiModule, ProjectsModule, RetrievalModule, ToolsModule],
  controllers: [DesignSessionsController, ProjectDesignSessionsController],
  providers: [
    DesignSessionsRepository,
    DesignSessionsService,
    DesignSessionDiagramsService,
    DesignValidationService,
    DeterministicDesignValidatorService,
    MermaidFlowchartValidator
  ]
})
export class DesignSessionsModule {}
