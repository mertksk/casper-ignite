import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { appConfig } from "./config";

declare global {
  var prisma: PrismaClient | undefined;
}

const logLevel = appConfig.isDev ? ["query", "info", "warn", "error"] : ["error"];

export const prisma =
  global.prisma ??
  new PrismaClient({
    log: logLevel,
  });

if (appConfig.isDev) {
  global.prisma = prisma;
}
