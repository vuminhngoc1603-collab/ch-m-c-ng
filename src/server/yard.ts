import type { PetSource, Zodiac } from "@prisma/client";
import { prisma, lockUser, AppError, type Tx } from "@/lib/db";
import { ALL_ZODIAC, ZODIAC } from "@/lib/zodiac";
import { eggPrice, type Rules } from "@/lib/rules";
import { addDays, periodOf, vn } from "@/lib/time";
import { getRules } from "./settings";
import { pointBalance } from "./wallet";
import { logActivity } from "./log";

export type Rng = () => number;

function pick<T>(arr: T[], rng: Rng): T {
  return arr[Math.floor(rng() * arr.length)];
}

export async function alivePets(userId: string, tx: Tx = prisma) {
  return tx.pet.findMany({ where: { userId, status: "ALIVE" }, orderBy: { slot: "asc" } });
}

/** Cấp 1 con ngẫu nhiên chưa có trong sân. Trả về null nếu sân đã đủ. */
export async function grantRandomPet(
  tx: Tx,
  userId: string,
  source: PetSource,
  rules: Rules,
  opts: { slot?: number; rng?: Rng; now?: Date } = {},
) {
  const rng = opts.rng ?? Math.random;
  const alive = await alivePets(userId, tx);
  if (alive.length >= rules.maxPets) return null;
  const owned = new Set(alive.map((p) => p.zodiac));
  const candidates = ALL_ZODIAC.filter((z) => !owned.has(z));
  if (candidates.length === 0) return null;
  const zodiac: Zodiac = pick(candidates, rng);
  const used = new Set(alive.map((p) => p.slot));
  let slot = opts.slot;
  if (slot == null || slot < 0 || slot >= rules.maxPets || used.has(slot)) {
    slot = [...Array(rules.maxPets).keys()].find((s) => !used.has(s))!;
  }
  return tx.pet.create({
    data: { userId, zodiac, slot, source, acquiredAt: opts.now ?? new Date() },
  });
}

/** Một con ngẫu nhiên trong sân chết; ghi phạt; nếu là con cuối thì hẹn cấp con mới hôm sau. */
export async function killRandomPet(
  tx: Tx,
  userId: string,
  reason: string,
  rules: Rules,
  now: Date,
  rng: Rng = Math.random,
  day?: string,
) {
  const alive = await alivePets(userId, tx);
  if (alive.length === 0) return null;
  const victim = pick(alive, rng);
  await tx.pet.update({
    where: { id: victim.id },
    data: { status: "DEAD", diedAt: now, deathReason: reason },
  });
  const v = vn(now);
  const eventDay = day ?? v.day;
  await tx.penalty.create({
    data: {
      userId,
      petId: victim.id,
      amountVnd: rules.penaltyVnd,
      period: periodOf(eventDay),
      reason: `${ZODIAC[victim.zodiac].name} chết: ${reason}`,
    },
  });
  if (alive.length === 1) {
    await tx.user.update({ where: { id: userId }, data: { regrantOn: addDays(eventDay, 1) } });
  }
  await logActivity(userId, "pet.died", { petId: victim.id, zodiac: victim.zodiac, reason }, null, tx);
  return victim;
}

export async function buyEgg(userId: string, slot: number | undefined, now = new Date(), rng: Rng = Math.random) {
  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const rules = await getRules(tx);
    const alive = await alivePets(userId, tx);
    if (alive.length >= rules.maxPets) throw new AppError("Sân đã đủ 12 con giáp.");
    const price = eggPrice(alive.length, rules);
    const balance = await pointBalance(userId, tx);
    if (balance < price) throw new AppError(`Chưa đủ điểm: trứng giá ${price} điểm, bạn có ${balance} điểm.`);
    const pet = await grantRandomPet(tx, userId, "EGG", rules, { slot, rng, now });
    if (!pet) throw new AppError("Không còn con giáp nào để nở.");
    if (price > 0) {
      await tx.pointLedger.create({
        data: { userId, amount: -price, type: "EGG_PURCHASE", period: periodOf(vn(now).day), refId: pet.id, reason: `Mua trứng nở ${ZODIAC[pet.zodiac].name}` },
      });
    }
    await tx.user.update({ where: { id: userId }, data: { regrantOn: null } });
    await logActivity(userId, "egg.buy", { price, petId: pet.id, zodiac: pet.zodiac }, null, tx);
    return { pet, price };
  });
}

/** Chuyển con giáp sang chỗ khác trong sân; nếu chỗ đó có con thì đổi chỗ cho nhau. */
export async function movePet(userId: string, petId: string, slot: number) {
  return prisma.$transaction(async (tx) => {
    await lockUser(tx, userId);
    const rules = await getRules(tx);
    if (!Number.isInteger(slot) || slot < 0 || slot >= rules.maxPets) throw new AppError("Chỗ ở không hợp lệ.");
    const pet = await tx.pet.findFirst({ where: { id: petId, userId, status: "ALIVE" } });
    if (!pet) throw new AppError("Không tìm thấy con giáp.");
    const other = await tx.pet.findFirst({ where: { userId, status: "ALIVE", slot } });
    if (other && other.id !== pet.id) await tx.pet.update({ where: { id: other.id }, data: { slot: pet.slot } });
    await tx.pet.update({ where: { id: pet.id }, data: { slot } });
  });
}

/** Cấp con miễn phí đầu tiên nếu người dùng chưa từng có con nào. */
export async function ensureFirstPet(tx: Tx, userId: string, rules: Rules, now: Date) {
  const count = await tx.pet.count({ where: { userId } });
  if (count > 0) return null;
  return grantRandomPet(tx, userId, "FREE", rules, { now });
}
