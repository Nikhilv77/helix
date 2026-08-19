import type { PrismaService } from "../database/prisma.service";

export class DsaNotesService {
  constructor(private readonly prisma: PrismaService) {}

  async get(ownerId: string, slug: string) {
    const note = await this.prisma.userDsaQuestionNote.findUnique({
      where: { ownerId_slug: { ownerId, slug } },
      select: { content: true, updatedAt: true }
    });

    return { content: note?.content ?? "", updatedAt: note?.updatedAt ?? null };
  }

  async save(ownerId: string, slug: string, content: string) {
    const note = await this.prisma.userDsaQuestionNote.upsert({
      where: { ownerId_slug: { ownerId, slug } },
      create: { ownerId, slug, content },
      update: { content },
      select: { content: true, updatedAt: true }
    });

    return note;
  }
}
