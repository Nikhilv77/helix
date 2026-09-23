import { Prisma } from "@prisma/client";
import {
  EMPTY_SYSTEM_DESIGN_CANVAS,
  systemDesignCanvasDocumentSchema,
  type SystemDesignCanvasDocument,
  type VersionedSystemDesignCanvas
} from "@/features/interviews/domain/system-design-canvas";
import { NotFoundErrorException } from "@/server/common/exceptions/not-found-error.exception";
import type { PrismaService } from "@/server/database/prisma.service";

export class ArchitecturePracticeCanvasConflictError extends Error {
  constructor(readonly current: VersionedSystemDesignCanvas) {
    super("This architecture canvas changed in another tab.");
  }
}

/** Owner-scoped, optimistic database persistence for the practice design canvas. */
export class ArchitecturePracticeCanvasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly now: () => Date = () => new Date()
  ) {}

  async get(ownerId: string, blockId: string): Promise<VersionedSystemDesignCanvas> {
    const block = await this.prisma.architectureBlock.findUnique({
      where: { id_ownerId: { id: blockId, ownerId } },
      select: { canvasDocument: true, canvasRevision: true, canvasUpdatedAt: true }
    });
    if (!block) {
      throw new NotFoundErrorException(
        "ARCHITECTURE_DESIGN_BLOCK_NOT_FOUND",
        "The architecture practice block was not found."
      );
    }
    return {
      document: systemDesignCanvasDocumentSchema.parse(
        block.canvasDocument ?? EMPTY_SYSTEM_DESIGN_CANVAS
      ),
      revision: block.canvasRevision,
      updatedAt: block.canvasUpdatedAt?.getTime() ?? 0
    };
  }

  async save(
    ownerId: string,
    blockId: string,
    rawDocument: SystemDesignCanvasDocument,
    expectedRevision: number
  ): Promise<VersionedSystemDesignCanvas> {
    const document = systemDesignCanvasDocumentSchema.parse(rawDocument);
    const updatedAt = this.now();
    const saved = await this.prisma.architectureBlock.updateManyAndReturn({
      where: { id: blockId, ownerId, canvasRevision: expectedRevision },
      data: {
        canvasDocument: document as Prisma.InputJsonValue,
        canvasRevision: { increment: 1 },
        canvasUpdatedAt: updatedAt
      },
      select: { canvasDocument: true, canvasRevision: true, canvasUpdatedAt: true }
    });
    if (saved.length === 0) {
      throw new ArchitecturePracticeCanvasConflictError(await this.get(ownerId, blockId));
    }
    return {
      document: systemDesignCanvasDocumentSchema.parse(saved[0]!.canvasDocument),
      revision: saved[0]!.canvasRevision,
      updatedAt: saved[0]!.canvasUpdatedAt?.getTime() ?? updatedAt.getTime()
    };
  }
}
