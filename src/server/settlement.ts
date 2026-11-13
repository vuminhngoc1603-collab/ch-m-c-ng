import { prisma } from "@/lib/db";
import { pointsFromNet, type Rules } from "@/lib/rules";
import { periodBounds } from "@/lib/time";
import { getRules } from "./settings";

export type MonthRow = {
  userId: string;
  name: string;
  email: string;
  role: string | null;
  feedCoins: number;
  stealGainCoins: number;
  stealLossCoins: number;
  adjustCoins: number;
  netCoins: number;
  points: number;
  rewardVnd: number;
  missedCount: number;
  deathCount: number;
  penaltyVnd: number;
  settled: boolean;
};

/** Biến động xu trong tháng = cho ăn + trộm được − bị trộm (+ điều chỉnh của admin nếu có). */
export async function computeMonth(period: string, rules?: Rules): Promise<MonthRow[]> {
  rules ??= await getRules();
  const users = await prisma.user.findMany({
    where: { role: { in: ["FULLTIME", "PARTTIME"] } },
    orderBy: { name: "asc" },
  });
  const { first, last } = periodBounds(period);
  const coin = await prisma.coinLedger.groupBy({ by: ["userId", "type"], where: { period }, _sum: { amount: true } });
  const missed = await prisma.attendance.groupBy({ by: ["userId"], where: { feedStatus: "MISSED", day: { gte: first, lte: last } }, _count: true });
  const pen = await prisma.penalty.groupBy({ by: ["userId"], where: { period }, _sum: { amountVnd: true }, _count: true });
  const settled = await prisma.monthlySettlement.findMany({ where: { period } });
  const sMap = new Map(settled.map((s) => [s.userId, s]));
  return users.map((u) => {
    const s = sMap.get(u.id);
    if (s) {
      return {
        userId: u.id, name: u.name ?? u.email, email: u.email, role: u.role,
        feedCoins: s.feedCoins, stealGainCoins: s.stealGainCoins, stealLossCoins: s.stealLossCoins, adjustCoins: s.adjustCoins,
        netCoins: s.netCoins, points: s.points, rewardVnd: s.rewardVnd, missedCount: s.missedCount,
        deathCount: s.deathCount, penaltyVnd: s.penaltyVnd, settled: true,
      };
    }
    const sum = (t: string) => coin.find((c) => c.userId === u.id && c.type === t)?._sum.amount ?? 0;
    const feedCoins = sum("FEED");
    const stealGainCoins = sum("STEAL_GAIN");
    const stealLossCoins = -sum("STEAL_LOSS");
    const adjustCoins = sum("ADJUST");
    const netCoins = feedCoins + stealGainCoins - stealLossCoins + adjustCoins;
    const p = pen.find((x) => x.userId === u.id);
    return {
      userId: u.id, name: u.name ?? u.email, email: u.email, role: u.role,
      feedCoins, stealGainCoins, stealLossCoins, adjustCoins, netCoins,
      points: pointsFromNet(netCoins, rules),
      rewardVnd: Math.round((netCoins * rules.coinVnd) / 100),
      missedCount: missed.find((m) => m.userId === u.id)?._count ?? 0,
      deathCount: p?._count ?? 0,
      penaltyVnd: p?._sum.amountVnd ?? 0,
      settled: false,
    };
  });
}

/** Chốt tháng: lưu báo cáo và cộng điểm. Chạy lại không tạo trùng (unique userId+period). */
export async function settleMonth(period: string) {
  const rules = await getRules();
  const rows = await computeMonth(period, rules);
  let created = 0;
  for (const r of rows) {
    if (r.settled) continue;
    await prisma.$transaction(async (tx) => {
      const exists = await tx.monthlySettlement.findUnique({ where: { userId_period: { userId: r.userId, period } } });
      if (exists) return;
      const s = await tx.monthlySettlement.create({
        data: {
          userId: r.userId, period, feedCoins: r.feedCoins, stealGainCoins: r.stealGainCoins, stealLossCoins: r.stealLossCoins,
          adjustCoins: r.adjustCoins, netCoins: r.netCoins, points: r.points, rewardVnd: r.rewardVnd,
          missedCount: r.missedCount, deathCount: r.deathCount, penaltyVnd: r.penaltyVnd,
        },
      });
      if (r.points > 0) {
        await tx.pointLedger.create({
          data: { userId: r.userId, amount: r.points, type: "SETTLEMENT", period, refId: s.id, reason: `Quy đổi biến động xu tháng ${period}` },
        });
      }
      created++;
    });
  }
  return created;
}

export function toCsv(rows: MonthRow[]): string {
  const head = ["Họ tên", "Email", "Vai trò", "Xu cho ăn", "Xu trộm được", "Xu bị trộm", "Điều chỉnh", "Biến động xu", "Điểm", "Thưởng tham chiếu (đ)", "Lần bỏ bữa", "Con chết", "Phạt (đ)", "Đã chốt"];
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const c = (x: number) => (x / 100).toFixed(2);
  const lines = rows.map((r) =>
    [r.name, r.email, r.role ?? "", c(r.feedCoins), c(r.stealGainCoins), c(r.stealLossCoins), c(r.adjustCoins), c(r.netCoins), r.points, r.rewardVnd, r.missedCount, r.deathCount, r.penaltyVnd, r.settled ? "x" : ""].map(esc).join(","),
  );
  return "﻿" + [head.map(esc).join(","), ...lines].join("\n");
}
