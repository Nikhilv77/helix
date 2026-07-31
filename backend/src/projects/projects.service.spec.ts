import { Project, ProjectStatus } from "@prisma/client";
import { ConflictErrorException } from "../common/exceptions/conflict-error.exception";
import { NotFoundErrorException } from "../common/exceptions/not-found-error.exception";
import { ListProjectsQueryDto } from "./dto/list-projects-query.dto";
import { ProjectsRepository } from "./projects.repository";
import { ProjectsService } from "./projects.service";

describe("ProjectsService", () => {
  const project: Project = {
    id: "11111111-1111-4111-8111-111111111111",
    ownerId: "user_123",
    name: "Project",
    description: null,
    status: ProjectStatus.ACTIVE,
    archivedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z")
  };

  function createService(repository: Partial<ProjectsRepository>): ProjectsService {
    return new ProjectsService(repository as ProjectsRepository);
  }

  it("creates a project through the repository", async () => {
    const create = jest.fn().mockResolvedValue(project);
    const service = createService({ create });

    await expect(service.createProject({ name: "Project" })).resolves.toBe(project);
    expect(create).toHaveBeenCalledWith({ name: "Project" });
  });

  it("returns paginated projects", async () => {
    const findMany = jest.fn().mockResolvedValue({ projects: [project], total: 1 });
    const query = Object.assign(new ListProjectsQueryDto(), { page: 1, limit: 20 });
    const service = createService({ findMany });

    await expect(service.listProjects(query)).resolves.toEqual({
      data: [project],
      meta: {
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1
        }
      }
    });
  });

  it("throws not found when a project does not exist", async () => {
    const service = createService({
      findById: jest.fn().mockResolvedValue(null)
    });

    await expect(service.getProject(project.id)).rejects.toBeInstanceOf(NotFoundErrorException);
  });

  it("rejects archiving an already archived project", async () => {
    const service = createService({
      findById: jest.fn().mockResolvedValue({ ...project, status: ProjectStatus.ARCHIVED })
    });

    await expect(service.archiveProject(project.id)).rejects.toBeInstanceOf(ConflictErrorException);
  });

  it("archives an active project", async () => {
    const archive = jest.fn().mockResolvedValue({ ...project, status: ProjectStatus.ARCHIVED });
    const service = createService({
      findById: jest.fn().mockResolvedValue(project),
      archive
    });

    await expect(service.archiveProject(project.id)).resolves.toMatchObject({
      status: ProjectStatus.ARCHIVED
    });
    expect(archive).toHaveBeenCalledWith(project.id);
  });
});
