import type { Shift, User } from "@prisma/client";
import { prisma, AppError, type Tx } from "@/lib/db";
import { shiftsOverlap } from "@/lib/rules";
import { addDays, vn, weekdayOf } from "@/lib/time";
import { getRules } from "./settings";
import { logActivity } from "./log";

export async function activeShifts(tx: Tx = prisma) {
  return tx.shift.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { feedStart: "asc" }] });
}

/** Thứ Hai của tuần chứa `day`. */
export function mondayOf(day: string): string {
  const wd = weekdayOf(day);
  return addDays(day, wd === 0 ? -6 : 1 - wd);
}

export function weekDays(monday: string): string[] {
  return [...Array(7).keys()].map((i) => addDays(monday, i));
}

/**
 * Cổng đăng ký ca: mở cả ngày thứ Sáu (giờ VN) cho tuần kế tiếp (T2..CN).
 * Hết thứ Sáu thì khóa.
 */
export async function registrationWindow(now: Date) {
  const rules = await getRules();
  const v = vn(now);
  const open = v.weekday === rules.registrationWeekday;
  const nextMonday = addDays(mondayOf(v.day), 7);
  return { open, targetMonday: nextMonday, days: weekDays(nextMonday), today: v.day };
}

/** Ngày nghỉ: lễ chung hoặc nghỉ phép/nghỉ lễ cá nhân đã duyệt. */
export async function isDayOff(userId: string, day: string, tx: Tx = prisma): Promise<boolean> {
  const holiday = await tx.holiday.findUnique({ where: { day } });
  if (holiday) return true;
  const leave = await tx.leaveRequest.findFirst({
    where: { userId, status: "APPROVED", startDay: { lte: day }, endDay: { gte: day } },
  });
  return !!leave;
}

/** Các lượt bắt buộc của một người trong ngày. */
export async function expectedShifts(user: Pick<User, "id" | "role" | "status">, day: string, tx: Tx = prisma): Promise<Shift[]> {
  if (user.status !== "ACTIVE" || !user.role || user.role === "ADMIN") return [];
  if (await isDayOff(user.id, day, tx)) return [];
  if (user.role === "FULLTIME") {
    const wd = weekdayOf(day);
    if (wd === 0 || wd === 6) return []; // T7/CN không cần cho ăn
    return tx.shift.findMany({ where: { kind: "FULLTIME", active: true }, orderBy: { feedStart: "asc" } });
  }
  const regs = await tx.shiftRegistration.findMany({ where: { userId: user.id, day }, include: { shift: true } });
  return regs.map((r) => r.shift).sort((a, b) => a.feedStart - b.feedStart);
}

type Entry = { day: string; shiftId: string };

async function validateEntries(entries: Entry[], allowedDays: string[] | null, tx: Tx) {
  const shifts = await tx.shift.findMany({ where: { kind: "PARTTIME", active: true } });
  const byId = new Map(shifts.map((s) => [s.id, s]));
  const perDay = new Map<string, Shift[]>();
  for (const e of entries) {
    const s = byId.get(e.shiftId);
    if (!s) throw new AppError("Ca không hợp lệ.");
    if (allowedDays && !allowedDays.includes(e.day)) throw new AppError(`Ngày ${e.day} không thuộc tuần đăng ký.`);
    const list = perDay.get(e.day) ?? [];
    for (const o of list) {
      if (o.id === s.id) continue;
      if (shiftsOverlap(o, s)) throw new AppError(`Ngày ${e.day}: ca ${o.name} và ${s.name} chồng giờ.`);
    }
    list.push(s);
    perDay.set(e.day, list);
  }
}

/** Part-time tự đăng ký ca tuần sau (chỉ trong ngày thứ Sáu). Thay toàn bộ lịch tuần đó. */
export async function saveMyRegistrations(userId: string, entries: Entry[], now = new Date()) {
  const win = await registrationWindow(now);
  if (!win.open) throw new AppError("Cổng đăng ký chỉ mở vào thứ Sáu. Lịch đã khóa, chỉ admin được đổi hộ.");
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== "ACTIVE" || user.role !== "PARTTIME") throw new AppError("Chỉ part-time mới đăng ký ca.");
    await validateEntries(entries, win.days, tx);
    await tx.shiftRegistration.deleteMany({ where: { userId, day: { in: win.days } } });
    await tx.shiftRegistration.createMany({
      data: entries.map((e) => ({ userId, day: e.day, shiftId: e.shiftId, createdById: userId })),
      skipDuplicates: true,
    });
    await logActivity(userId, "schedule.register", { week: win.targetMonday, count: entries.length }, null, tx);
  });
}

/** Admin đổi ca hộ part-time cho một tuần bất kỳ, bắt buộc ghi lý do. */
export async function adminSetRegistrations(adminId: string, userId: string, monday: string, entries: Entry[], note: string) {
  if (!note.trim()) throw new AppError("Cần ghi lý do khi đổi ca hộ.");
  const days = weekDays(monday);
  return prisma.$transaction(async (tx) => {
    await validateEntries(entries, days, tx);
    // Không xóa lượt đã cho ăn: chỉ thay đăng ký, lượt chưa tới hạn sẽ được đồng bộ lại.
    await tx.shiftRegistration.deleteMany({ where: { userId, day: { in: days } } });
    await tx.shiftRegistration.createMany({
      data: entries.map((e) => ({ userId, day: e.day, shiftId: e.shiftId, createdById: adminId, note })),
      skipDuplicates: true,
    });
    await logActivity(adminId, "admin.schedule.set", { userId, week: monday, count: entries.length, note }, null, tx);
  });
}
