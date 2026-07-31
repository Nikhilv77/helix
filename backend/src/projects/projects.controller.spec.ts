import { Project, ProjectStatus } from "@prisma/client";
import { ListProjectsQueryDto } from "./dto/list-projects-query.dto";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";

describe("ProjectsController", () => {
  const userId = "user_123";
  const project: Project = {
    id: "11111111-1111-4111-8111-111111111111",
    ownerId: userId,
    name: "Project",
    description: null,
    status: ProjectStatus.ACTIVE,
    archivedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z")
  };

  it("delegates project creation to the service", async () => {
    const createProject = jest.fn().mockResolvedValue(project);
    const controller = new ProjectsController({ createProject } as unknown as ProjectsService);

    await expect(controller.createProject({ name: "Project" }, userId)).resolves.toBe(project);
    expect(createProject).toHaveBeenCalledWith({ name: "Project" }, userId);
  });

  it("delegates project listing to the service", async () => {
    const listProjects = jest.fn().mockResolvedValue({
      data: [project],
      meta: { pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } }
    });
    const controller = new ProjectsController({ listProjects } as unknown as ProjectsService);
    const query = new ListProjectsQueryDto();

    await expect(controller.listProjects(query, userId)).resolves.toMatchObject({
      data: [project]
    });
    expect(listProjects).toHaveBeenCalledWith(query, userId);
  });

  it("delegates archive and restore commands to the service", async () => {
    const archiveProject = jest
      .fn()
      .mockResolvedValue({ ...project, status: ProjectStatus.ARCHIVED });
    const restoreProject = jest.fn().mockResolvedValue(project);
    const controller = new ProjectsController({
      archiveProject,
      restoreProject
    } as unknown as ProjectsService);

    await expect(controller.archiveProject(project.id, userId)).resolves.toMatchObject({
      status: ProjectStatus.ARCHIVED
    });
    await expect(controller.restoreProject(project.id, userId)).resolves.toBe(project);
    expect(archiveProject).toHaveBeenCalledWith(project.id, userId);
    expect(restoreProject).toHaveBeenCalledWith(project.id, userId);
  });
});
