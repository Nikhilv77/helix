import { describe, expect, it, vi } from "vitest";
import { EMPTY_SYSTEM_DESIGN_CANVAS } from "@/features/interviews/domain/system-design-canvas";
import type { PrismaService } from "@/server/database/prisma.service";
import {
  ArchitecturePracticeCanvasConflictError,
  ArchitecturePracticeCanvasService
} from "./canvas.service";

const UPDATED_AT = new Date("2026-09-23T12:00:00.000Z");

function createService() {
  const findUnique = vi.fn();
  const updateManyAndReturn = vi.fn();
  const prisma = {
    architectureBlock: { findUnique, updateManyAndReturn }
  } as unknown as PrismaService;
  return {
    service: new ArchitecturePracticeCanvasService(prisma, () => UPDATED_AT),
    findUnique,
    updateManyAndReturn
  };
}

describe("ArchitecturePracticeCanvasService", () => {
  it("loads only a block owned by the caller and returns an empty first revision", async () => {
    const { service, findUnique } = createService();
    findUnique.mockResolvedValue({
      canvasDocument: null,
      canvasRevision: 0,
      canvasUpdatedAt: null
    });

    await expect(service.get("owner-a", "block-a")).resolves.toEqual({
      document: EMPTY_SYSTEM_DESIGN_CANVAS,
      revision: 0,
      updatedAt: 0
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { id_ownerId: { id: "block-a", ownerId: "owner-a" } },
      select: { canvasDocument: true, canvasRevision: true, canvasUpdatedAt: true }
    });

    findUnique.mockResolvedValue(null);
    await expect(service.get("owner-b", "block-a")).rejects.toMatchObject({
      code: "ARCHITECTURE_DESIGN_BLOCK_NOT_FOUND"
    });
  });

  it("saves only at the expected revision with owner and block scoped in the atomic update", async () => {
    const { service, updateManyAndReturn } = createService();
    updateManyAndReturn.mockResolvedValue([
      {
        canvasDocument: EMPTY_SYSTEM_DESIGN_CANVAS,
        canvasRevision: 3,
        canvasUpdatedAt: UPDATED_AT
      }
    ]);

    await expect(
      service.save("owner-a", "block-a", EMPTY_SYSTEM_DESIGN_CANVAS, 2)
    ).resolves.toEqual({
      document: EMPTY_SYSTEM_DESIGN_CANVAS,
      revision: 3,
      updatedAt: UPDATED_AT.getTime()
    });
    expect(updateManyAndReturn).toHaveBeenCalledWith({
      where: { id: "block-a", ownerId: "owner-a", canvasRevision: 2 },
      data: {
        canvasDocument: EMPTY_SYSTEM_DESIGN_CANVAS,
        canvasRevision: { increment: 1 },
        canvasUpdatedAt: UPDATED_AT
      },
      select: { canvasDocument: true, canvasRevision: true, canvasUpdatedAt: true }
    });
  });

  it("returns the current version on a conflict without overwriting the caller's edits", async () => {
    const { service, findUnique, updateManyAndReturn } = createService();
    updateManyAndReturn.mockResolvedValue([]);
    findUnique.mockResolvedValue({
      canvasDocument: EMPTY_SYSTEM_DESIGN_CANVAS,
      canvasRevision: 4,
      canvasUpdatedAt: UPDATED_AT
    });

    await expect(service.save("owner-a", "block-a", EMPTY_SYSTEM_DESIGN_CANVAS, 2)).rejects.toEqual(
      new ArchitecturePracticeCanvasConflictError({
        document: EMPTY_SYSTEM_DESIGN_CANVAS,
        revision: 4,
        updatedAt: UPDATED_AT.getTime()
      })
    );
  });
});
