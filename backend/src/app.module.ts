import { Module } from "@nestjs/common";
import { AiModule } from "./ai/ai.module";
import { CommonModule } from "./common/common.module";
import { ConfigModule } from "./config/config.module";
import { DatabaseModule } from "./database/database.module";
import { DesignSessionsModule } from "./design-sessions/design-sessions.module";
import { HealthModule } from "./health/health.module";
import { KnowledgeModule } from "./knowledge/knowledge.module";
import { ProjectsModule } from "./projects/projects.module";
import { RetrievalModule } from "./retrieval/retrieval.module";
import { ToolsModule } from "./tools/tools.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule,
    AiModule,
    CommonModule,
    DatabaseModule,
    HealthModule,
    UsersModule,
    ProjectsModule,
    DesignSessionsModule,
    KnowledgeModule,
    RetrievalModule,
    ToolsModule
  ]
})
export class AppModule {}
