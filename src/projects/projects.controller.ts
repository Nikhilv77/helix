import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { Project } from "@prisma/client";
import { ClerkAuthGuard } from "../auth/clerk-auth.guard";
import { CurrentUserId } from "../auth/current-user-id.decorator";
import { PaginatedResult } from "../common/types/paginated-result.type";
import { CreateProjectDto } from "./dto/create-project.dto";
import { ListProjectsQueryDto } from "./dto/list-projects-query.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { ProjectsService } from "./projects.service";

@Controller({
  path: "projects",
  version: "1"
})
@UseGuards(ClerkAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  createProject(@Body() body: CreateProjectDto, @CurrentUserId() userId: string): Promise<Project> {
    return this.projectsService.createProject(body, userId);
  }

  @Get()
  listProjects(
    @Query() query: ListProjectsQueryDto,
    @CurrentUserId() userId: string
  ): Promise<PaginatedResult<Project>> {
    return this.projectsService.listProjects(query, userId);
  }

  @Get(":id")
  getProject(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUserId() userId: string
  ): Promise<Project> {
    return this.projectsService.getProject(id, userId);
  }

  @Patch(":id")
  updateProject(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateProjectDto,
    @CurrentUserId() userId: string
  ): Promise<Project> {
    return this.projectsService.updateProject(id, body, userId);
  }

  @Post(":id/archive")
  archiveProject(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUserId() userId: string
  ): Promise<Project> {
    return this.projectsService.archiveProject(id, userId);
  }

  @Post(":id/restore")
  restoreProject(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUserId() userId: string
  ): Promise<Project> {
    return this.projectsService.restoreProject(id, userId);
  }

  @Delete(":id")
  deleteProject(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUserId() userId: string
  ): Promise<Project> {
    return this.projectsService.deleteProject(id, userId);
  }
}
