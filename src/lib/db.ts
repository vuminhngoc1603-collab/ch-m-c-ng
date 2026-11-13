import { PrismaClient, Prisma } from "@prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = prisma;

export type Tx = Prisma.TransactionClient;

/** Khóa dòng User để tuần tự hóa các thao tác ví/sân của một người. */
export async function lockUser(tx: Tx, userId: string) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
}

export class AppError extends Error {}
