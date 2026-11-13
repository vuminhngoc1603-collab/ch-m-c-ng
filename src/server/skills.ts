import type { Zodiac } from "@prisma/client";
import { prisma, type Tx } from "@/lib/db";
import type { Rules } from "@/lib/rules";
import { activeSkills } from "@/lib/skills";

/** Kỹ năng đang có tác dụng của 1 người (con còn sống + kỹ năng đang bật). */
export async function skillsOf(userId: string, rules: Rules, tx: Tx = prisma): Promise<Set<Zodiac>> {
  const pets = await tx.pet.findMany({ where: { userId, status: "ALIVE" }, select: { zodiac: true } });
  return activeSkills(pets.map((p) => p.zodiac), rules);
}

/** Các tháng (YYYY-MM) thuộc cùng quý với `period`. */
export function quarterPeriods(period: string): string[] {
  const [y, m] = period.split("-").map(Number);
  const q0 = Math.floor((m - 1) / 3) * 3 + 1;
  return [q0, q0 + 1, q0 + 2].map((mm) => `${y}-${String(mm).padStart(2, "0")}`);
}

export async function countUses(tx: Tx, userId: string, zodiac: Zodiac, where: { periods?: string[]; refPrefix?: string }) {
  return tx.skillUse.count({
    where: {
      userId,
      zodiac,
      ...(where.periods ? { period: { in: where.periods } } : {}),
      ...(where.refPrefix ? { refKey: { startsWith: where.refPrefix } } : {}),
    },
  });
}
