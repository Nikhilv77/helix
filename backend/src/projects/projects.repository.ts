import { Injectable } from "@nestjs/common";
import { Prisma, Project, ProjectStatus } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { ListProjectsQueryDto, ProjectSortField } from "./dto/list-projects-query.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";

@Injectable()
export class ProjectsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateProjectDto, ownerId = "local-dev"): Promise<Project> {
    return this.prisma.project.create({
      data: {
        ...data,
        ownerId
      }
    });
  }

  async findMany(
    query: ListProjectsQueryDto,
    ownerId?: string
  ): Promise<{ projects: Project[]; total: number }> {
    const where = this.buildWhere(query, ownerId);
    const orderBy = this.buildOrderBy(query.sortBy, query.sortOrder);
    const skip = (query.page - 1) * query.limit;

    const [projects, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        orderBy,
        skip,
        take: query.limit
      }),
      this.prisma.project.count({ where })
    ]);

    return { projects, total };
  }

  findById(id: string, ownerId?: string): Promise<Project | null> {
    if (!ownerId) {
      return this.prisma.project.findUnique({
        where: { id }
      });
    }

    return this.prisma.project.findFirst({
      where: { id, ownerId }
    });
  }

  update(id: string, data: UpdateProjectDto): Promise<Project> {
    return this.prisma.project.update({
      where: { id },
      data
    });
  }

  archive(id: string): Promise<Project> {
    return this.prisma.project.update({
      where: { id },
      data: {
        status: ProjectStatus.ARCHIVED,
        archivedAt: new Date()
      }
    });
  }

  restore(id: string): Promise<Project> {
    return this.prisma.project.update({
      where: { id },
      data: {
        status: ProjectStatus.ACTIVE,
        archivedAt: null
      }
    });
  }

  delete(id: string): Promise<Project> {
    return this.prisma.project.delete({
      where: { id }
    });
  }

  private buildWhere(query: ListProjectsQueryDto, ownerId?: string): Prisma.ProjectWhereInput {
    return {
      ownerId,
      status: query.status,
      name:
        query.search && query.search.length > 0
          ? {
              contains: query.search,
              mode: "insensitive"
            }
          : undefined
    };
  }

  private buildOrderBy(
    sortBy: ProjectSortField,
    sortOrder: ListProjectsQueryDto["sortOrder"]
  ): Prisma.ProjectOrderByWithRelationInput {
    switch (sortBy) {
      case "name":
        return { name: sortOrder };
      case "status":
        return { status: sortOrder };
      case "updatedAt":
        return { updatedAt: sortOrder };
      case "createdAt":
        return { createdAt: sortOrder };
    }
  }
}
