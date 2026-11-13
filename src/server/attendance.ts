import type { User } from "@prisma/client";
import { prisma, lockUser, AppError, type Tx } from "@/lib/db";
import { feedCents, inWindow } from "@/lib/rules";
import { vn, vnInstant, fmtMin } from "@/lib/time";
import { getRules } from "./settings";
import { skillsOf } from "./skills";
import { expectedShifts } from "./schedule";
import { logActivity } from "./log";

type Meta = { ip?: string | null; ua?: string | null };

/**
 * Đồng bộ các lượt bắt buộc của một người trong một ngày:
 * tạo lượt còn thiếu, xóa lượt chưa diễn ra không còn bắt buộc (vd vừa được duyệt nghỉ, admin đổi ca).
 */
export async function syncSlots(user: User, day: string, tx: Tx = prisma) {
  let shifts = await expectedShifts(user, day, tx);
  // Ngày được duyệt tài khoản: chỉ tính những lượt có khung cho ăn kết thúc sau lúc duyệt.
  if (user.approvedAt) {
    const a = vn(user.approvedAt);
    if (day < a.day) shifts = [];
    else if (day === a.day) shifts = shifts.filter((s) => s.feedEnd > a.minutes);
  } else shifts = [];
  const ids = shifts.map((s) => s.id);
  await tx.attendance.deleteMany({
    where: { userId: user.id, day, feedStatus: "PENDING", closeStatus: { in: ["PENDING", "NONE"] }, shiftId: { notIn: ids } },
  });
  if (shifts.length) {
    await tx.attendance.createMany({
      data: shifts.map((s) => ({ userId: user.id, day, shiftId: s.id, closeStatus: s.closeStart == null ? "NONE" : "PENDING" })),
      skipDuplicates: true,
    });
  }
}

export async function todaySlots(userId: string, now = new Date()) {
  const v = vn(now);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  await syncSlots(user, v.day);
  return prisma.attendance.findMany({
    where: { userId, day: v.day },
    include: { shift: true, thefts: { include: { thief: { select: { name: true, email: true } } } } },
    orderBy: { shift: { feedStart: "asc" } },
  });
}

/** Check in = cho ăn. Mỗi lần thành công ghi 1 xu × hệ số theo số con đang sống. */
export async function feed(userId: string, now = new Date(), meta: Meta = {}) {
  const v = vn(now);
  const slots = await todaySlots(userId, now);
  const slot = slots.find((s) => s.feedStatus === "PENDING" && inWindow(v.minutes, s.shift.feedStart, s.shift.feedEnd));
  if (!slot) {
    const done = slots.find((s) => s.feedStatus === "FED" && inWindow(v.minutes, s.shift.feedStart, s.shift.feedEnd));
    if (done) throw new AppError("Bạn đã cho ăn lượt này rồi.");
    const next = slots.find((s) => s.feedStatus === "PENDING" && s.shift.feedStart > v.minutes);
    throw new AppError(
      next
        ? `Chưa tới giờ cho ăn. Lượt tiếp theo: ${next.shift.name} ${fmtMin(next.shift.feedStart)}–${fmtMin(next.shift.feedEnd)}.`
        : "Hiện không có khung cho ăn nào của bạn.",
    );
  }
  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const rules = await getRules(tx);
    const alive = await tx.pet.count({ where: { userId, status: "ALIVE" } });
    const sk = await skillsOf(userId, rules, tx);
    const cents = feedCents(alive, rules, sk.has("THIN") ? rules.skills.thinBonus : 0);
    const upd = await tx.attendance.updateMany({
      where: { id: slot.id, feedStatus: "PENDING" },
      data: { feedStatus: "FED", feedAt: now, feedIp: meta.ip ?? null, feedUa: meta.ua ?? null, coinsEarned: cents },
    });
    if (upd.count === 0) throw new AppError("Bạn đã cho ăn lượt này rồi.");
    await tx.coinLedger.create({
      data: { userId, amount: cents, type: "FEED", period: v.period, refId: slot.id, reason: `Cho ăn ${slot.shift.name} ${v.day}` },
    });
    await tx.user.update({ where: { id: userId }, data: { missStreak: 0 } });
    await logActivity(userId, "attendance.feed", { slotId: slot.id, cents, alive }, meta.ip, tx);
    return { slot, cents, alive };
  });
}

/** Check out = đóng cửa sân. Không sinh xu nhưng bảo vệ ví khỏi bị trộm. */
export async function closeYard(userId: string, now = new Date(), meta: Meta = {}) {
  const v = vn(now);
  const slots = await todaySlots(userId, now);
  const slot = slots.find((s) => s.closeStatus === "PENDING" && inWindow(v.minutes, s.shift.closeStart, s.shift.closeEnd));
  if (!slot) {
    const next = slots.find((s) => s.closeStatus === "PENDING" && (s.shift.closeStart ?? 0) > v.minutes);
    throw new AppError(
      next
        ? `Chưa tới giờ đóng cửa. Khung đóng cửa: ${fmtMin(next.shift.closeStart!)}–${fmtMin(next.shift.closeEnd!)}.`
        : "Hiện không có khung đóng cửa nào của bạn.",
    );
  }
  const upd = await prisma.attendance.updateMany({
    where: { id: slot.id, closeStatus: "PENDING" },
    data: { closeStatus: "CLOSED", closeAt: now, closeIp: meta.ip ?? null, closeUa: meta.ua ?? null },
  });
  if (upd.count === 0) throw new AppError("Bạn đã đóng cửa lượt này rồi.");
  await logActivity(userId, "attendance.close", { slotId: slot.id }, meta.ip);
  return slot;
}

export function slotDeadline(day: string, minutes: number) {
  return vnInstant(day, minutes);
}
