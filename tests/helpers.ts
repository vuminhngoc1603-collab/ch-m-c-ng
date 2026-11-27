import { prisma } from "@/lib/db";
import { vnInstant, parseMin } from "@/lib/time";
import { seed } from "../prisma/seed";
import type { Role } from "@prisma/client";

export async function resetDb() {
  await prisma.$executeRawUnsafe(`TRUNCATE "User","Holiday","HolidaySkip","Setting","Shift" RESTART IDENTITY CASCADE`);
  await seed(prisma);
}

/** Thời điểm theo giờ VN: at("2026-11-16", "8:40") */
export function at(day: string, hm: string) {
  return vnInstant(day, parseMin(hm));
}

export async function makeUser(email: string, role: Role, approvedAt: Date) {
  return prisma.user.create({ data: { email, name: email.split("@")[0], role, status: "ACTIVE", approvedAt } });
}

/** Rng xác định: luôn chọn phần tử đầu. */
export const first = () => 0;
