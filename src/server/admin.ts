import type { LeaveType, Role, UserStatus } from "@prisma/client";
import { prisma, AppError, lockUser } from "@/lib/db";
import { vn, vnInstant } from "@/lib/time";
import { vnPublicHolidays } from "@/lib/vn-holidays";
import { syncPublicHolidays } from "./holidays";
import { getRules } from "./settings";
import { ensureFirstPet } from "./yard";
import { logActivity } from "./log";

export async function approveUser(adminId: string, userId: string, role: Role, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const u = await tx.user.findUnique({ where: { id: userId } });
    if (!u) throw new AppError("Không tìm thấy tài khoản.");
    await tx.user.update({
      where: { id: userId },
      data: { status: "ACTIVE", role, approvedAt: u.approvedAt ?? now, approvedById: adminId },
    });
    if (role !== "ADMIN") await ensureFirstPet(tx, userId, await getRules(tx), now);
    await logActivity(adminId, "admin.user.approve", { userId, role }, null, tx);
  });
}

export async function setUserStatus(adminId: string, userId: string, status: UserStatus) {
  if (adminId === userId) throw new AppError("Không thể tự khóa tài khoản của mình.");
  await prisma.user.update({ where: { id: userId }, data: { status } });
  if (status === "DISABLED") await prisma.session.deleteMany({ where: { userId } });
  await logActivity(adminId, "admin.user.status", { userId, status });
}

export async function setUserRole(adminId: string, userId: string, role: Role) {
  await prisma.user.update({ where: { id: userId }, data: { role } });
  await logActivity(adminId, "admin.user.role", { userId, role });
}

/** Điều chỉnh xu (xử lý khiếu nại): bút toán mới có lý do, không sửa bút toán cũ. */
export async function adjustCoins(adminId: string, userId: string, cents: number, reason: string, now = new Date()) {
  if (!reason.trim()) throw new AppError("Cần ghi lý do điều chỉnh.");
  if (!Number.isFinite(cents) || cents === 0) throw new AppError("Số xu không hợp lệ.");
  await prisma.coinLedger.create({
    data: { userId, amount: Math.round(cents), type: "ADJUST", period: vn(now).period, reason, createdById: adminId },
  });
  await logActivity(adminId, "admin.coins.adjust", { userId, cents, reason });
}

export async function adjustPoints(adminId: string, userId: string, points: number, reason: string) {
  if (!reason.trim()) throw new AppError("Cần ghi lý do điều chỉnh.");
  if (!Number.isInteger(points) || points === 0) throw new AppError("Số điểm không hợp lệ.");
  await prisma.pointLedger.create({ data: { userId, amount: points, type: "ADJUST", reason, createdById: adminId } });
  await logActivity(adminId, "admin.points.adjust", { userId, points, reason });
}

// ---- Nghỉ lễ / nghỉ phép ----

export async function requestLeave(userId: string, type: LeaveType, startDay: string, endDay: string, reason: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDay) || !/^\d{4}-\d{2}-\d{2}$/.test(endDay) || endDay < startDay)
    throw new AppError("Khoảng ngày không hợp lệ.");
  const r = await prisma.leaveRequest.create({ data: { userId, type, startDay, endDay, reason } });
  await logActivity(userId, "leave.request", { id: r.id, startDay, endDay, type });
  return r;
}

export async function reviewLeave(adminId: string, id: string, approve: boolean) {
  const r = await prisma.leaveRequest.update({
    where: { id },
    data: { status: approve ? "APPROVED" : "REJECTED", reviewedById: adminId, reviewedAt: new Date() },
  });
  await logActivity(adminId, "admin.leave.review", { id, approve });
  return r;
}

export async function addHoliday(adminId: string, day: string, name: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new AppError("Ngày không hợp lệ.");
  // Admin thêm/sửa (kể cả sửa tên ngày lễ tự động) -> MANUAL, và bỏ đánh dấu "đã xoá" nếu có.
  await prisma.$transaction([
    prisma.holiday.upsert({ where: { day }, create: { day, name, source: "MANUAL" }, update: { name, source: "MANUAL" } }),
    prisma.holidaySkip.deleteMany({ where: { day } }),
  ]);
  await logActivity(adminId, "admin.holiday.add", { day, name });
}

/** Xoá ngày lễ. Nếu là ngày lễ nhà nước tự động thì ghi nhớ để không tự nạp lại (vd chính phủ hoán đổi ngày nghỉ). */
export async function removeHoliday(adminId: string, day: string) {
  const isPublic = vnPublicHolidays(Number(day.slice(0, 4))).some((h) => h.day === day);
  await prisma.$transaction(async (tx) => {
    const h = await tx.holiday.findUnique({ where: { day } });
    if (h) await tx.holiday.delete({ where: { day } });
    if (isPublic || h?.source === "AUTO") await tx.holidaySkip.upsert({ where: { day }, create: { day }, update: {} });
  });
  await logActivity(adminId, "admin.holiday.remove", { day });
}

/** Khôi phục ngày lễ nhà nước tự động đã bị xoá. */
export async function restorePublicHoliday(adminId: string, day: string) {
  await prisma.holidaySkip.deleteMany({ where: { day } });
  await syncPublicHolidays(vnInstant(day));
  await logActivity(adminId, "admin.holiday.restore", { day });
}
