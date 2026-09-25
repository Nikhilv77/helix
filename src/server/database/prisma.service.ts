import { PrismaClient } from "@prisma/client";

export class PrismaService extends PrismaClient {
  async connect(): Promise<void> {
    await this.$connect();
  }

  async disconnect(): Promise<void> {
    await this.$disconnect();
  }
}

const prismaGlobal = globalThis as typeof globalThis & {
  trailgradPrisma?: PrismaService;
};

/** One pool per running server instance, including production warm starts. */
export function getPrismaService(): PrismaService {
  return (prismaGlobal.trailgradPrisma ??= new PrismaService());
}
