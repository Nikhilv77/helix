import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import { DesignSession } from "@prisma/client";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { CurrentUserId } from "../auth/current-user-id.decorator";
import { CreateDesignSessionDto } from "./dto/create-design-session.dto";
import { SubmitClarificationsDto } from "./dto/submit-clarifications.dto";
import { UpdateDesignSessionDto } from "./dto/update-design-session.dto";
import { DesignSessionDiagramsService } from "./design-session-diagrams.service";
import { DesignValidationService } from "./design-validation.service";
import { DesignSessionsService } from "./design-sessions.service";

@Controller({
  path: "design-sessions",
  version: "1"
})
@UseGuards(ClerkAuthGuard)
export class DesignSessionsController {
  constructor(
    private readonly designSessionsService: DesignSessionsService,
    private readonly designSessionDiagramsService: DesignSessionDiagramsService,
    private readonly designValidationService: DesignValidationService
  ) {}

  @Get(":id")
  getDesignSession(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUserId() userId: string
  ): Promise<DesignSession> {
    return this.designSessionsService.getDesignSession(id, userId);
  }

  @Patch(":id")
  updateDesignSession(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateDesignSessionDto,
    @CurrentUserId() userId: string
  ): Promise<DesignSession> {
    return this.designSessionsService.updateDesignSession(id, body, userId);
  }

  @Delete(":id")
  deleteDesignSession(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUserId() userId: string
  ): Promise<DesignSession> {
    return this.designSessionsService.deleteDesignSession(id, userId);
  }

  @Post(":id/analyze-requirements")
  analyzeRequirements(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUserId() userId: string
  ): Promise<unknown> {
    return this.designSessionsService.analyzeRequirements(id, userId);
  }

  @Get(":id/requirements")
  getRequirements(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUserId() userId: string
  ): Promise<unknown> {
    return this.designSessionsService.getRequirements(id, userId);
  }

  @Post(":id/clarifications")
  submitClarifications(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: SubmitClarificationsDto,
    @CurrentUserId() userId: string
  ): Promise<unknown> {
    return this.designSessionsService.submitClarifications(id, body, userId);
  }

  @Post(":id/calculate-capacity")
  calculateCapacity(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @CurrentUserId() userId: string
  ): Promise<unknown> {
    return this.designSessionsService.calculateCapacity(id, body, userId);
  }

  @Get(":id/capacity")
  getCapacity(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUserId() userId: string
  ): Promise<unknown> {
    return this.designSessionsService.getCapacity(id, userId);
  }

  @Post(":id/generate-design")
  generateDesign(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUserId() userId: string
  ): Promise<unknown> {
    return this.designSessionsService.generateDesign(id, userId);
  }

  @Get(":id/design")
  getDesign(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUserId() userId: string
  ): Promise<unknown> {
    return this.designSessionsService.getDesign(id, userId);
  }

  @Post(":id/generate-diagram")
  generateDiagram(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUserId() userId: string
  ): Promise<unknown> {
    return this.designSessionDiagramsService.generateDiagram(id, userId);
  }

  @Get(":id/diagram")
  getDiagram(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUserId() userId: string
  ): Promise<unknown> {
    return this.designSessionDiagramsService.getDiagram(id, userId);
  }

  @Post(":id/validate-design")
  validateDesign(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUserId() userId: string
  ): Promise<unknown> {
    return this.designValidationService.validateDesign(id, userId);
  }

  @Get(":id/validation")
  getValidation(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUserId() userId: string
  ): Promise<unknown> {
    return this.designValidationService.getValidation(id, userId);
  }
}

@Controller({
  path: "projects/:projectId/design-sessions",
  version: "1"
})
@UseGuards(ClerkAuthGuard)
export class ProjectDesignSessionsController {
  constructor(private readonly designSessionsService: DesignSessionsService) {}

  @Post()
  createDesignSession(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() body: CreateDesignSessionDto,
    @CurrentUserId() userId: string
  ): Promise<DesignSession> {
    return this.designSessionsService.createDesignSession(projectId, body, userId);
  }

  @Get()
  listProjectDesignSessions(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @CurrentUserId() userId: string
  ): Promise<DesignSession[]> {
    return this.designSessionsService.listProjectDesignSessions(projectId, userId);
  }
}
