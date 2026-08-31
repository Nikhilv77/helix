import type { Prisma } from "@prisma/client";
import type { DsaNoteDrawing } from "@/lib/dsa/dsa-note-drawing";
import type { PrismaService } from "../database/prisma.service";

export class DsaNotesService {
  constructor(private readonly prisma: PrismaService) {}

  async get(ownerId: string, slug: string) {
    const note = await this.prisma.userDsaQuestionNote.findUnique({
      where: { ownerId_slug: { ownerId, slug } },
      select: { content: true, drawing: true, updatedAt: true }
    });

    return {
      content: note?.content ?? "",
      drawing: note?.drawing ?? null,
      updatedAt: note?.updatedAt ?? null
    };
  }

  async save(ownerId: string, slug: string, content: string, drawing?: DsaNoteDrawing) {
    const drawingData = drawing as Prisma.InputJsonValue | undefined;
    const note = await this.prisma.userDsaQuestionNote.upsert({
      where: { ownerId_slug: { ownerId, slug } },
      create: { ownerId, slug, content, drawing: drawingData },
      update: { content, drawing: drawingData },
      select: { content: true, drawing: true, updatedAt: true }
    });

    return note;
  }
}
