import type { Zodiac } from "@prisma/client";
import { prisma, AppError, type Tx } from "@/lib/db";
import { stealCents, type Rules } from "@/lib/rules";
import { vn } from "@/lib/time";
import { getRules } from "./settings";
import { coinBalance } from "./wallet";
import { logActivity } from "./log";
import { skillsOf, countUses } from "./skills";
import { mondayOf } from "./schedule";

type SlotLike = { id: string; userId: string; shift: { closeEnd: number | null }; thefts: { thiefId: string }[] };

/** Sân này đang được Dần canh (lần quên đóng cửa đầu tháng)? */
async function guardedByDan(tx: Tx, slot: { id: string; userId: string }) {
  return (await tx.skillUse.count({ where: { userId: slot.userId, zodiac: "DAN", refKey: `att:${slot.id}` } })) > 0;
}

/**
 * Luật trộm cho 1 cặp (người trộm, sân), đã tính kỹ năng hai bên.
 * Trả về lý do không trộm được, hoặc số xu lấy được + kỹ năng đã dùng.
 */
async function evaluate(
  tx: Tx,
  rules: Rules,
  minutes: number,
  day: string,
  thiefId: string,
  thiefSkills: Set<Zodiac>,
  slot: SlotLike,
  now: Date,
): Promise<{ ok: false; why: string } | { ok: true; amount: number; usesThan: boolean; victimSkills: Set<Zodiac> }> {
  const opensAt = Math.max(rules.stealWindowStart, slot.shift.closeEnd ?? 0);
  if (minutes < opensAt) return { ok: false, why: "Chưa tới giờ trộm sân này." };
  // Ngọ "Phi nước đại": vài phút đầu chỉ người có Ngọ được trộm.
  if (!thiefSkills.has("NGO") && minutes < opensAt + rules.skills.ngoPriorityMinutes && rules.skills.enabled.includes("NGO")) {
    const anyNgo = await tx.pet.count({ where: { zodiac: "NGO", status: "ALIVE", userId: { not: slot.userId }, user: { status: "ACTIVE" } } });
    if (anyNgo > 0) return { ok: false, why: `${rules.skills.ngoPriorityMinutes} phút đầu chỉ người có Ngọ được trộm sân này.` };
  }
  if (slot.thefts.some((t) => t.thiefId === thiefId)) return { ok: false, why: "Bạn đã trộm sân này rồi." };
  let usesThan = false;
  if (slot.thefts.length >= rules.stealMaxThieves) {
    // Thân "Láu lỉnh": vượt giới hạn số người trộm, vài lần mỗi tuần.
    if (!thiefSkills.has("THAN") || slot.thefts.length > rules.stealMaxThieves) return { ok: false, why: "Sân này đã bị trộm đủ số lần." };
    const used = await countUses(tx, thiefId, "THAN", { refPrefix: `week:${mondayOf(day)}:` });
    if (used >= rules.skills.thanPerWeek) return { ok: false, why: "Sân này đã bị trộm đủ số lần (Thân đã dùng hết lượt tuần này)." };
    usesThan = true;
  }
  if (await guardedByDan(tx, slot)) return { ok: false, why: "Dần đang canh cửa sân này." };
  const victimSkills = await skillsOf(slot.userId, rules, tx);
  // Tỵ "Nọc độc": ai đã trộm sân này thì bị khoá, vài ngày sau mới được trộm lại sân này.
  if (victimSkills.has("TI") && rules.skills.tiLockDays > 0) {
    const since = new Date(now.getTime() - rules.skills.tiLockDays * 86_400_000);
    const last = await tx.theft.findFirst({ where: { thiefId, victimId: slot.userId, createdAt: { gt: since } }, orderBy: { createdAt: "desc" } });
    if (last) {
      const until = vn(new Date(last.createdAt.getTime() + rules.skills.tiLockDays * 86_400_000));
      const [, m, d] = until.day.split("-");
      return { ok: false, why: `Tỵ của chủ sân đã cắn bạn: bạn bị khoá trộm sân này tới ${String(Math.floor(until.minutes / 60)).padStart(2, "0")}h${String(until.minutes % 60).padStart(2, "0")} ngày ${d}/${m}.` };
    }
  }
  const balance = await coinBalance(slot.userId, tx);
  const amount = stealCents(balance, rules, {
    percent: victimSkills.has("MUI") ? rules.skills.muiStealPercent : undefined,
    maxCoins: thiefSkills.has("TY") ? rules.skills.tyStealMaxCoins : undefined,
  });
  if (amount <= 0) return { ok: false, why: "Ví của chủ sân không còn xu để trộm." };
  return { ok: true, amount, usesThan, victimSkills };
}

/** Danh sách sân quên đóng cửa đang mở cho `thiefId` trộm (chỉ 17h30–24h00 cùng ngày). */
export async function stealableYards(thiefId: string, now = new Date()) {
  const rules = await getRules();
  const v = vn(now);
  if (v.minutes < rules.stealWindowStart || v.minutes >= rules.stealWindowEnd) return [];
  const slots = await prisma.attendance.findMany({
    where: { day: v.day, closeStatus: "FORGOT", userId: { not: thiefId } },
    include: { shift: true, user: { select: { id: true, name: true, email: true } }, thefts: true },
  });
  const thiefSkills = await skillsOf(thiefId, rules);
  const out = [];
  for (const s of slots) {
    const r = await evaluate(prisma, rules, v.minutes, v.day, thiefId, thiefSkills, s, now);
    if (!r.ok) continue;
    out.push({ attendanceId: s.id, victim: s.user, shiftName: s.shift.name, thieves: s.thefts.length, amount: r.amount, viaThan: r.usesThan });
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
    // Khoá ví hai bên theo thứ tự id để tránh deadlock khi 2 người trộm lẫn nhau.
    for (const id of [slot.userId, thiefId].sort()) await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${id} FOR UPDATE`;
    const thiefSkills = await skillsOf(thiefId, rules, tx);
    const r = await evaluate(tx, rules, v.minutes, v.day, thiefId, thiefSkills, slot, now);
    if (!r.ok) throw new AppError(r.why);
    const amount = r.amount;
    const theft = await tx.theft.create({ data: { attendanceId, victimId: slot.userId, thiefId, amount, createdAt: now } });
    await tx.coinLedger.createMany({
      data: [
        { userId: slot.userId, amount: -amount, type: "STEAL_LOSS", period: v.period, refId: theft.id, reason: `Bị ${thief.name ?? thief.email} trộm (quên đóng cửa ${slot.shift.name})` },
        { userId: thiefId, amount, type: "STEAL_GAIN", period: v.period, refId: theft.id, reason: `Trộm sân quên đóng cửa` },
      ],
    });
    const notes: string[] = [];
    if (r.usesThan) {
      await tx.skillUse.create({ data: { userId: thiefId, zodiac: "THAN", refKey: `week:${mondayOf(v.day)}:${theft.id}`, period: v.period, note: "Trộm vượt giới hạn số người" } });
      notes.push("Thân giúp bạn lẻn vào sân đã đủ người trộm");
    }
    if (thiefSkills.has("TY")) await tx.skillUse.create({ data: { userId: thiefId, zodiac: "TY", refKey: `theft:${theft.id}`, period: v.period, note: "Trộm với trần cao hơn" } });
    if (r.victimSkills.has("MUI")) await tx.skillUse.create({ data: { userId: slot.userId, zodiac: "MUI", refKey: `theft:${theft.id}`, period: v.period, note: "Bị trộm ít hơn" } });
    if (r.victimSkills.has("TI") && rules.skills.tiLockDays > 0) {
      await tx.skillUse.create({ data: { userId: slot.userId, zodiac: "TI", refKey: `theft:${theft.id}`, period: v.period, note: `Khoá người trộm ${rules.skills.tiLockDays} ngày` } });
      notes.push(`Tỵ của chủ sân khoá bạn ${rules.skills.tiLockDays} ngày không trộm được sân này nữa`);
    }
    await logActivity(thiefId, "theft", { theftId: theft.id, victimId: slot.userId, amount, than: r.usesThan }, ip, tx);
    return { theft, amount, notes };
  });
}
