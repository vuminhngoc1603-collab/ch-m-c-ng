import { prisma, lockUser } from "@/lib/db";
import { shouldDie } from "@/lib/rules";
import { addDays, periodOf, prevPeriod, vn, weekdayOf } from "@/lib/time";
import { getRules } from "./settings";
import { syncSlots } from "./attendance";
import { ensureFirstPet, grantRandomPet, killRandomPet, type Rng } from "./yard";
import { settleMonth } from "./settlement";
import { skillsOf, countUses } from "./skills";
import { mondayOf } from "./schedule";
import { feedCents, type Rules } from "@/lib/rules";
import type { User } from "@prisma/client";

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
  const stats = { synced: 0, missed: 0, deaths: 0, forgot: 0, regranted: 0, firstPets: 0, settled: 0, skills: 0 };

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
      const period = periodOf(slot.day);
      const before = await tx.user.findUniqueOrThrow({ where: { id: slot.userId } });
      // Bộ đếm theo tháng tính từ lần chết gần nhất trong tháng (sang tháng mới thì đếm lại từ 0).
      const monthly = (before.monthMissPeriod === period ? before.monthMisses : 0) + 1;
      const user = await tx.user.update({
        where: { id: slot.userId },
        data: { missStreak: { increment: 1 }, monthMisses: monthly, monthMissPeriod: period },
      });
      if (shouldDie(user.missStreak, monthly, rules)) {
        const reason =
          user.missStreak >= rules.deathStreak
            ? `bỏ bữa ${user.missStreak} lần liên tiếp`
            : `bỏ bữa ${monthly} lần trong tháng ${period}`;
        const dead = await killRandomPet(tx, slot.userId, reason, rules, now, rng, slot.day);
        if (dead) stats.deaths++;
        // Sau mỗi lần chết (hoặc Mão đỡ chết): đếm lại từ 0, phải bỏ đủ 3 bữa liên tiếp / 5 bữa nữa mới chết tiếp.
        await tx.user.update({ where: { id: slot.userId }, data: { missStreak: 0, monthMisses: 0 } });
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
    if (upd.count && status === "FORGOT") {
      stats.forgot++;
      // Dần "Gầm canh cửa": lần quên đóng cửa đầu tháng không ai trộm được.
      const sk = await skillsOf(slot.userId, rules);
      if (sk.has("DAN")) {
        const period = periodOf(slot.day);
        const used = await countUses(prisma, slot.userId, "DAN", { periods: [period] });
        if (used < rules.skills.danPerMonth) {
          const ok = await prisma.skillUse
            .create({ data: { userId: slot.userId, zodiac: "DAN", refKey: `att:${slot.id}`, period, note: `Canh cửa (quên đóng cửa ${slot.day})` } })
            .catch(() => null); // chạy song song: lượt kia đã ghi
          if (ok) stats.skills++;
        }
      }
    }
  }

  // 4b. Kỹ năng theo tuần / ngày lễ.
  stats.skills += await runSkillRewards(users, v.day, rules, now);

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

/**
 * Sửu "Cần cù": tuần (T2–CN) đã kết thúc, có đi làm và không bỏ bữa nào -> +xu.
 * Tuất "Trung thành": ngày lễ chung, con tự cho ăn thay -> nhận xu như đi làm (giới hạn số ngày/tháng).
 * Idempotent nhờ unique(userId, zodiac, refKey).
 */
async function runSkillRewards(users: User[], today: string, rules: Rules, now: Date) {
  let n = 0;
  const lastMonday = addDays(mondayOf(today), -7); // tuần vừa kết thúc
  const holidays = await prisma.holiday.findMany({ where: { day: { gte: addDays(today, -BACKFILL_DAYS), lte: today } }, orderBy: { day: "asc" } });
  const ftShifts = await prisma.shift.findMany({ where: { kind: "FULLTIME", active: true } });
  for (const user of users) {
    const sk = await skillsOf(user.id, rules);
    if (sk.has("SUU")) {
      for (const monday of [addDays(lastMonday, -7), lastMonday]) {
        const sunday = addDays(monday, 6);
        const suu = await prisma.pet.findFirst({ where: { userId: user.id, zodiac: "SUU", status: "ALIVE" } });
        if (!suu || vn(suu.acquiredAt).day > monday) continue; // phải nuôi Sửu từ đầu tuần
        const days = { gte: monday, lte: sunday };
        const [fed, missed] = await Promise.all([
          prisma.attendance.count({ where: { userId: user.id, day: days, feedStatus: "FED" } }),
          prisma.attendance.count({ where: { userId: user.id, day: days, feedStatus: "MISSED" } }),
        ]);
        if (fed === 0 || missed > 0) continue;
        n += await grantSkillCoins(user.id, "SUU", `week:${monday}`, periodOf(sunday), rules.skills.suuWeeklyCoins * 100, `Sửu cần cù: tuần ${monday} không bỏ bữa`, now);
      }
    }
    if (sk.has("TUAT") && holidays.length) {
      const tuat = await prisma.pet.findFirst({ where: { userId: user.id, zodiac: "TUAT", status: "ALIVE" } });
      for (const h of holidays) {
        if (!tuat || vn(tuat.acquiredAt).day > h.day) continue;
        if (user.approvedAt && vn(user.approvedAt).day > h.day) continue;
        const period = periodOf(h.day);
        if ((await countUses(prisma, user.id, "TUAT", { periods: [period] })) >= rules.skills.tuatDaysPerMonth) continue;
        // Số lượt cho ăn người này lẽ ra phải làm hôm đó nếu không phải ngày lễ.
        const wd = weekdayOf(h.day);
        const slots =
          user.role === "FULLTIME"
            ? wd === 0 || wd === 6 ? 0 : ftShifts.length
            : await prisma.shiftRegistration.count({ where: { userId: user.id, day: h.day } });
        if (slots === 0) continue;
        const alive = await prisma.pet.count({ where: { userId: user.id, status: "ALIVE" } });
        const cents = slots * feedCents(alive, rules, sk.has("THIN") ? rules.skills.thinBonus : 0);
        n += await grantSkillCoins(user.id, "TUAT", `holiday:${h.day}`, period, cents, `Tuất trực lễ ${h.name} (${h.day}): tự cho ăn ${slots} lượt`, now);
      }
    }
  }
  return n;
}

async function grantSkillCoins(userId: string, zodiac: "SUU" | "TUAT", refKey: string, period: string, cents: number, reason: string, now: Date) {
  return prisma
    .$transaction(async (tx) => {
    const exists = await tx.skillUse.findUnique({ where: { userId_zodiac_refKey: { userId, zodiac, refKey } } });
    if (exists) return 0;
    await tx.skillUse.create({ data: { userId, zodiac, refKey, period, amount: cents, note: reason, createdAt: now } });
    await tx.coinLedger.create({ data: { userId, amount: cents, type: "SKILL", period, refId: refKey, reason, createdAt: now } });
    return 1;
  })
    .catch(() => 0); // trùng unique khi 2 lần quét chạy cùng lúc: lần kia đã cộng
}
