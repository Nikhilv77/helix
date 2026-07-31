import { DesignSession, DesignSessionStatus } from "@prisma/client";
import {
  DesignSessionsController,
  ProjectDesignSessionsController
} from "./design-sessions.controller";
import { DesignSessionDiagramsService } from "./design-session-diagrams.service";
import { DesignValidationService } from "./design-validation.service";
import { DesignSessionsService } from "./design-sessions.service";

describe("DesignSessionsController", () => {
  const userId = "user_123";
  const session: DesignSession = {
    id: "33333333-3333-4333-8333-333333333333",
    projectId: "11111111-1111-4111-8111-111111111111",
    title: "Session",
    problemStatement: "Design a system",
    status: DesignSessionStatus.DRAFT,
    currentStep: null,
    failureCode: null,
    failureMessage: null,
    requirementAnalysis: null,
    clarificationAnswers: null,
    requirementsAnalyzedAt: null,
    capacityCalculation: null,
    capacityCalculatedAt: null,
    generatedDesign: null,
    designGeneratedAt: null,
    architectureDiagram: null,
    diagramGeneratedAt: null,
    designValidation: null,
    designValidatedAt: null,
    startedAt: null,
    completedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z")
  };

  it("delegates get, patch, and delete to the service", async () => {
    const getDesignSession = jest.fn().mockResolvedValue(session);
    const updateDesignSession = jest.fn().mockResolvedValue({ ...session, title: "Updated" });
    const deleteDesignSession = jest.fn().mockResolvedValue(session);
    const analyzeRequirements = jest.fn().mockResolvedValue({ designSessionId: session.id });
    const getRequirements = jest.fn().mockResolvedValue({ designSessionId: session.id });
    const submitClarifications = jest.fn().mockResolvedValue({ designSessionId: session.id });
    const calculateCapacity = jest.fn().mockResolvedValue({ designSessionId: session.id });
    const getCapacity = jest.fn().mockResolvedValue({ designSessionId: session.id });
    const generateDesign = jest.fn().mockResolvedValue({ designSessionId: session.id });
    const getDesign = jest.fn().mockResolvedValue({ designSessionId: session.id });
    const generateDiagram = jest.fn().mockResolvedValue({ designSessionId: session.id });
    const getDiagram = jest.fn().mockResolvedValue({ designSessionId: session.id });
    const validateDesign = jest.fn().mockResolvedValue({ designSessionId: session.id });
    const getValidation = jest.fn().mockResolvedValue({ designSessionId: session.id });
    const controller = new DesignSessionsController(
      {
        getDesignSession,
        updateDesignSession,
        deleteDesignSession,
        analyzeRequirements,
        getRequirements,
        submitClarifications,
        calculateCapacity,
        getCapacity,
        generateDesign,
        getDesign
      } as unknown as DesignSessionsService,
      {
        generateDiagram,
        getDiagram
      } as unknown as DesignSessionDiagramsService,
      {
        validateDesign,
        getValidation
      } as unknown as DesignValidationService
    );

    await expect(controller.getDesignSession(session.id, userId)).resolves.toBe(session);
    await expect(
      controller.updateDesignSession(session.id, { title: "Updated" }, userId)
    ).resolves.toMatchObject({
      title: "Updated"
    });
    await expect(controller.deleteDesignSession(session.id, userId)).resolves.toBe(session);
    await expect(controller.analyzeRequirements(session.id, userId)).resolves.toEqual({
      designSessionId: session.id
    });
    await expect(controller.getRequirements(session.id, userId)).resolves.toEqual({
      designSessionId: session.id
    });
    await expect(
      controller.submitClarifications(
        session.id,
        {
          answers: [{ questionId: "CQ-1", answer: "Answer" }]
        },
        userId
      )
    ).resolves.toEqual({ designSessionId: session.id });
    await expect(
      controller.calculateCapacity(
        session.id,
        {
          monthlyActiveUsers: 1000
        },
        userId
      )
    ).resolves.toEqual({ designSessionId: session.id });
    await expect(controller.getCapacity(session.id, userId)).resolves.toEqual({
      designSessionId: session.id
    });
    await expect(controller.generateDesign(session.id, userId)).resolves.toEqual({
      designSessionId: session.id
    });
    await expect(controller.getDesign(session.id, userId)).resolves.toEqual({
      designSessionId: session.id
    });
    await expect(controller.generateDiagram(session.id, userId)).resolves.toEqual({
      designSessionId: session.id
    });
    await expect(controller.getDiagram(session.id, userId)).resolves.toEqual({
      designSessionId: session.id
    });
    await expect(controller.validateDesign(session.id, userId)).resolves.toEqual({
      designSessionId: session.id
    });
    await expect(controller.getValidation(session.id, userId)).resolves.toEqual({
      designSessionId: session.id
    });
    expect(getDesignSession).toHaveBeenCalledWith(session.id, userId);
    expect(updateDesignSession).toHaveBeenCalledWith(session.id, { title: "Updated" }, userId);
    expect(deleteDesignSession).toHaveBeenCalledWith(session.id, userId);
    expect(analyzeRequirements).toHaveBeenCalledWith(session.id, userId);
    expect(getRequirements).toHaveBeenCalledWith(session.id, userId);
    expect(submitClarifications).toHaveBeenCalledWith(
      session.id,
      {
        answers: [{ questionId: "CQ-1", answer: "Answer" }]
      },
      userId
    );
    expect(calculateCapacity).toHaveBeenCalledWith(
      session.id,
      {
        monthlyActiveUsers: 1000
      },
      userId
    );
    expect(getCapacity).toHaveBeenCalledWith(session.id, userId);
    expect(generateDesign).toHaveBeenCalledWith(session.id, userId);
    expect(getDesign).toHaveBeenCalledWith(session.id, userId);
    expect(generateDiagram).toHaveBeenCalledWith(session.id, userId);
    expect(getDiagram).toHaveBeenCalledWith(session.id, userId);
    expect(validateDesign).toHaveBeenCalledWith(session.id, userId);
    expect(getValidation).toHaveBeenCalledWith(session.id, userId);
  });

  it("delegates nested project session routes to the service", async () => {
    const createDesignSession = jest.fn().mockResolvedValue(session);
    const listProjectDesignSessions = jest.fn().mockResolvedValue([session]);
    const controller = new ProjectDesignSessionsController({
      createDesignSession,
      listProjectDesignSessions
    } as unknown as DesignSessionsService);

    await expect(
      controller.createDesignSession(
        session.projectId,
        {
          title: "Session",
          problemStatement: "Design a system"
        },
        userId
      )
    ).resolves.toBe(session);
    await expect(controller.listProjectDesignSessions(session.projectId, userId)).resolves.toEqual([
      session
    ]);
    expect(createDesignSession).toHaveBeenCalledWith(
      session.projectId,
      {
        title: "Session",
        problemStatement: "Design a system"
      },
      userId
    );
    expect(listProjectDesignSessions).toHaveBeenCalledWith(session.projectId, userId);
  });
});
