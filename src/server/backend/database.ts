import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";
import { Pool } from "pg";

const connectionString = process.env["DATABASE_URL"];

let prismaInstance: PrismaClient | undefined;
let poolInstance: Pool | undefined;

/**
 * Lazily create the PostgreSQL connection so importing the API does not connect
 * to a database during SSR module initialization. Never log the connection URL.
 */
export function getPrisma(): PrismaClient {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!prismaInstance) {
    poolInstance = new Pool({ connectionString });
    prismaInstance = new PrismaClient({ adapter: new PrismaPg(poolInstance) });
  }

  return prismaInstance;
}

export async function checkDatabaseConnection(): Promise<void> {
  const prisma = getPrisma();
  await prisma.$queryRawUnsafe("SELECT 1");
}

export async function disconnectDatabase(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = undefined;
  }
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = undefined;
  }
}
