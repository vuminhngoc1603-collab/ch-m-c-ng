import { prisma, AppError } from "@/lib/db";
import { stealCents } from "@/lib/rules";
import { vn } from "@/lib/time";
import { getRules } from "./settings";
import { coinBalance } from "./wallet";
import { logActivity } from "./log";

/** Danh sách sân quên đóng cửa đang mở cho `thiefId` trộm (chỉ 17h30–24h00 cùng ngày). */
export async function stealableYards(thiefId: string, now = new Date()) {
  const rules = await getRules();
  const v = vn(now);
  if (v.minutes < rules.stealWindowStart || v.minutes >= rules.stealWindowEnd) return [];
  const slots = await prisma.attendance.findMany({
    where: { day: v.day, closeStatus: "FORGOT", userId: { not: thiefId } },
    include: { shift: true, user: { select: { id: true, name: true, email: true } }, thefts: true },
  });
  const out = [];
  for (const s of slots) {
    const opensAt = Math.max(rules.stealWindowStart, s.shift.closeEnd ?? 0);
    if (v.minutes < opensAt) continue;
    if (s.thefts.length >= rules.stealMaxThieves) continue;
    if (s.thefts.some((t) => t.thiefId === thiefId)) continue;
    const balance = await coinBalance(s.userId);
    const amount = stealCents(balance, rules);
    if (amount <= 0) continue;
    out.push({ attendanceId: s.id, victim: s.user, shiftName: s.shift.name, thieves: s.thefts.length, amount });
  }
  return out;
}

export async function steal(thiefId: string, attendanceId: string, now = new Date(), ip?: string | null) {
  const v = vn(now);
  return prisma.$transaction(async (tx) => {
    const rules = await getRules(tx);
    const thief = await tx.user.findUnique({ where: { id: thiefId } });
    if (!thief || thief.status !== "ACTIVE" || (thief.role !== "FULLTIME" && thief.role !== "PARTTIME"))
      throw new AppError("Chỉ nhân viên full-time/part-time đang hoạt động mới được trộm xu.");
    if (v.minutes < rules.stealWindowStart || v.minutes >= rules.stealWindowEnd)
      throw new AppError("Chỉ được trộm từ 17h30 đến 24h00.");
    // Khóa lượt quên đóng cửa để không vượt quá số người trộm khi nhiều người bấm cùng lúc.
    await tx.$queryRaw`SELECT id FROM "Attendance" WHERE id = ${attendanceId} FOR UPDATE`;
    const slot = await tx.attendance.findUnique({ where: { id: attendanceId }, include: { shift: true, thefts: true } });
    if (!slot || slot.closeStatus !== "FORGOT" || slot.day !== v.day) throw new AppError("Sân này không mở cửa để trộm.");
    if (slot.userId === thiefId) throw new AppError("Không thể tự trộm sân của mình.");
    if (v.minutes < Math.max(rules.stealWindowStart, slot.shift.closeEnd ?? 0)) throw new AppError("Chưa tới giờ trộm sân này.");
    if (slot.thefts.length >= rules.stealMaxThieves) throw new AppError("Sân này đã bị trộm đủ số lần.");
    if (slot.thefts.some((t) => t.thiefId === thiefId)) throw new AppError("Bạn đã trộm sân này rồi.");
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${slot.userId} FOR UPDATE`;
    const balance = await coinBalance(slot.userId, tx);
    const amount = stealCents(balance, rules);
    if (amount <= 0) throw new AppError("Ví của chủ sân không còn xu để trộm.");
    const theft = await tx.theft.create({ data: { attendanceId, victimId: slot.userId, thiefId, amount, createdAt: now } });
    await tx.coinLedger.createMany({
      data: [
        { userId: slot.userId, amount: -amount, type: "STEAL_LOSS", period: v.period, refId: theft.id, reason: `Bị ${thief.name ?? thief.email} trộm (quên đóng cửa ${slot.shift.name})` },
        { userId: thiefId, amount, type: "STEAL_GAIN", period: v.period, refId: theft.id, reason: `Trộm sân quên đóng cửa` },
      ],
    });
    await logActivity(thiefId, "theft", { theftId: theft.id, victimId: slot.userId, amount }, ip, tx);
    return { theft, amount };
  });
}
