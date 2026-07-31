import { Injectable } from "@nestjs/common";
import { Project, ProjectStatus } from "@prisma/client";
import { ConflictErrorException } from "../common/exceptions/conflict-error.exception";
import { NotFoundErrorException } from "../common/exceptions/not-found-error.exception";
import { PaginatedResult } from "../common/types/paginated-result.type";
import { CreateProjectDto } from "./dto/create-project.dto";
import { ListProjectsQueryDto } from "./dto/list-projects-query.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { ProjectsRepository } from "./projects.repository";

@Injectable()
export class ProjectsService {
  constructor(private readonly projectsRepository: ProjectsRepository) {}

  createProject(data: CreateProjectDto, ownerId?: string): Promise<Project> {
    return ownerId
      ? this.projectsRepository.create(data, ownerId)
      : this.projectsRepository.create(data);
  }

  async listProjects(
    query: ListProjectsQueryDto,
    ownerId?: string
  ): Promise<PaginatedResult<Project>> {
    const { projects, total } = await this.projectsRepository.findMany(query, ownerId);

    return {
      data: projects,
      meta: {
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit)
        }
      }
    };
  }

  async getProject(id: string, ownerId?: string): Promise<Project> {
    return this.getExistingProject(id, ownerId);
  }

  async updateProject(id: string, data: UpdateProjectDto, ownerId?: string): Promise<Project> {
    await this.getExistingProject(id, ownerId);
    return this.projectsRepository.update(id, data);
  }

  async archiveProject(id: string, ownerId?: string): Promise<Project> {
    const project = await this.getExistingProject(id, ownerId);

    if (project.status === ProjectStatus.ARCHIVED) {
      throw new ConflictErrorException("PROJECT_ALREADY_ARCHIVED", "Project is already archived", {
        projectId: id
      });
    }

    return this.projectsRepository.archive(id);
  }

  async restoreProject(id: string, ownerId?: string): Promise<Project> {
    const project = await this.getExistingProject(id, ownerId);

    if (project.status === ProjectStatus.ACTIVE) {
      throw new ConflictErrorException("PROJECT_ALREADY_ACTIVE", "Project is already active", {
        projectId: id
      });
    }

    return this.projectsRepository.restore(id);
  }

  async deleteProject(id: string, ownerId?: string): Promise<Project> {
    await this.getExistingProject(id, ownerId);
    return this.projectsRepository.delete(id);
  }

  async getExistingProject(id: string, ownerId?: string): Promise<Project> {
    const project = await this.projectsRepository.findById(id, ownerId);

    if (!project) {
      throw new NotFoundErrorException("PROJECT_NOT_FOUND", "Project not found", {
        projectId: id
      });
    }

    return project;
  }
}
