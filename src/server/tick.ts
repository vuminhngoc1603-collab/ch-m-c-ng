import { prisma, lockUser } from "@/lib/db";
import { shouldDie } from "@/lib/rules";
import { addDays, periodOf, prevPeriod, vn } from "@/lib/time";
import { getRules } from "./settings";
import { syncSlots } from "./attendance";
import { ensureFirstPet, grantRandomPet, killRandomPet, type Rng } from "./yard";
import { settleMonth } from "./settlement";

const BACKFILL_DAYS = 7;

/**
 * Job quét định kỳ (idempotent, chạy lại không tạo trùng):
 *  1. Đồng bộ lượt bắt buộc mấy ngày gần nhất.
 *  2. Cấp con đầu miễn phí / cấp lại con mới sáng hôm sau khi mất con duy nhất.
 *  3. Ghi nhận bỏ bữa khi hết khung cho ăn -> tính chết + phạt.
 *  4. Ghi nhận quên đóng cửa khi hết khung đóng cửa -> mở cửa sổ trộm.
 *  5. Đầu tháng: chốt quyết toán tháng trước.
 */
export async function runTick(now = new Date(), rng: Rng = Math.random) {
  const rules = await getRules();
  const v = vn(now);
  const stats = { synced: 0, missed: 0, deaths: 0, forgot: 0, regranted: 0, firstPets: 0, settled: 0 };

  const users = await prisma.user.findMany({ where: { status: "ACTIVE", role: { in: ["FULLTIME", "PARTTIME"] } } });

  for (const user of users) {
    for (let i = BACKFILL_DAYS; i >= 0; i--) {
      await syncSlots(user, addDays(v.day, -i));
      stats.synced++;
    }
  }

  // 2. Cấp con: con đầu tiên miễn phí, và cấp lại sáng hôm sau khi mất con duy nhất.
  for (const user of users) {
    await prisma.$transaction(async (tx) => {
      await lockUser(tx, user.id);
      if (await ensureFirstPet(tx, user.id, rules, now)) stats.firstPets++;
      const fresh = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
      if (fresh.regrantOn && fresh.regrantOn <= v.day) {
        const alive = await tx.pet.count({ where: { userId: user.id, status: "ALIVE" } });
        if (alive === 0) {
          await grantRandomPet(tx, user.id, "REGRANT", rules, { rng, now });
          stats.regranted++;
        }
        await tx.user.update({ where: { id: user.id }, data: { regrantOn: null } });
      }
    });
  }

  // 3. Bỏ bữa: xử lý tuần tự theo thời gian cho từng người để đếm liên tiếp đúng.
  const pending = await prisma.attendance.findMany({
    where: { feedStatus: "PENDING", day: { lte: v.day }, user: { status: "ACTIVE" } },
    include: { shift: true },
  });
  const overdue = pending
    .filter((s) => s.day < v.day || s.shift.feedEnd < v.minutes)
    .sort((a, b) => (a.day === b.day ? a.shift.feedStart - b.shift.feedStart : a.day < b.day ? -1 : 1));
  for (const slot of overdue) {
    await prisma.$transaction(async (tx) => {
      await lockUser(tx, slot.userId);
      const upd = await tx.attendance.updateMany({ where: { id: slot.id, feedStatus: "PENDING" }, data: { feedStatus: "MISSED" } });
      if (upd.count === 0) return;
      stats.missed++;
      const user = await tx.user.update({ where: { id: slot.userId }, data: { missStreak: { increment: 1 } } });
      const period = periodOf(slot.day);
      const monthly = await tx.attendance.count({
        where: { userId: slot.userId, feedStatus: "MISSED", day: { gte: `${period}-01`, lte: `${period}-31` } },
      });
      if (shouldDie(user.missStreak, monthly, rules)) {
        const reason =
          user.missStreak >= rules.deathStreak
            ? `bỏ bữa ${user.missStreak} lần liên tiếp`
            : `bỏ bữa lần thứ ${monthly} trong tháng ${period}`;
        const dead = await killRandomPet(tx, slot.userId, reason, rules, now, rng, slot.day);
        if (dead) stats.deaths++;
        if (user.missStreak >= rules.deathStreak) await tx.user.update({ where: { id: slot.userId }, data: { missStreak: 0 } });
      }
    });
  }

  // 4. Quên đóng cửa.
  const openClose = await prisma.attendance.findMany({
    where: { closeStatus: "PENDING", day: { lte: v.day } },
    include: { shift: true },
  });
  for (const slot of openClose) {
    const ended = slot.day < v.day || (slot.shift.closeEnd ?? 0) < v.minutes;
    if (!ended) continue;
    // Chỉ tính quên đóng cửa khi hôm đó người dùng có đi làm (đã cho ăn ít nhất 1 lượt).
    const cameToWork = await prisma.attendance.count({ where: { userId: slot.userId, day: slot.day, feedStatus: "FED" } });
    const status = cameToWork > 0 ? "FORGOT" : "SKIPPED";
    const upd = await prisma.attendance.updateMany({ where: { id: slot.id, closeStatus: "PENDING" }, data: { closeStatus: status } });
    if (upd.count && status === "FORGOT") stats.forgot++;
  }

  // 5. Quyết toán tháng trước (chạy được nhiều lần, chỉ tạo phần còn thiếu).
  const last = await prisma.setting.findUnique({ where: { key: "lastSettledPeriod" } });
  const prev = prevPeriod(v.period);
  if ((last?.value as string | undefined) !== prev) {
    stats.settled = await settleMonth(prev);
    await prisma.setting.upsert({ where: { key: "lastSettledPeriod" }, create: { key: "lastSettledPeriod", value: prev }, update: { value: prev } });
  }

  await prisma.setting.upsert({
    where: { key: "lastTickAt" },
    create: { key: "lastTickAt", value: now.toISOString() },
    update: { value: now.toISOString() },
  });
  return stats;
}

/** Gọi khi người dùng mở trang: chạy quét nếu lần trước đã quá `minSeconds`. */
export async function maybeTick(now = new Date(), minSeconds = 60) {
  const last = await prisma.setting.findUnique({ where: { key: "lastTickAt" } });
  const t = last ? Date.parse(last.value as string) : 0;
  if (now.getTime() - t < minSeconds * 1000) return null;
  try {
    return await runTick(now);
  } catch (e) {
    console.error("tick failed", e);
    return null;
  }
}
