import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(moduleDirectory, "../../../.env") });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

declare global {
  // eslint-disable-next-line no-var
  var __db_prisma: PrismaClient | undefined;
}

export const prisma =
  global.__db_prisma ||
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__db_prisma = prisma;
}

export * from "@prisma/client";
