import { prisma, type Tx } from "@/lib/db";

export async function coinBalance(userId: string, tx: Tx = prisma): Promise<number> {
  const r = await tx.coinLedger.aggregate({ where: { userId }, _sum: { amount: true } });
  return r._sum.amount ?? 0;
}

export async function pointBalance(userId: string, tx: Tx = prisma): Promise<number> {
  const r = await tx.pointLedger.aggregate({ where: { userId }, _sum: { amount: true } });
  return r._sum.amount ?? 0;
}
