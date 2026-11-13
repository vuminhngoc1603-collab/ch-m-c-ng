import { prisma, type Tx } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function logActivity(
  userId: string | null,
  action: string,
  meta?: Prisma.InputJsonValue,
  ip?: string | null,
  tx: Tx = prisma,
) {
  await tx.activityLog.create({ data: { userId, action, meta, ip: ip ?? null } });
}
