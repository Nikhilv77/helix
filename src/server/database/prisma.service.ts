import { PrismaClient } from "@prisma/client";

export class PrismaService extends PrismaClient {
  async connect(): Promise<void> {
    await this.$connect();
  }

  async disconnect(): Promise<void> {
    await this.$disconnect();
  }
}
