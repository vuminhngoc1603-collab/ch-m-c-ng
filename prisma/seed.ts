import { PrismaClient } from "@prisma/client";
import { DEFAULT_RULES } from "../src/lib/rules";

const prisma = new PrismaClient();
const h = (hh: number, mm = 0) => hh * 60 + mm;

// Danh mục ca theo đặc tả v1.2 (admin chỉnh được sau trong trang Ca làm việc).
const SHIFTS = [
  { code: "FT_AM", name: "Nhịp sáng", kind: "FULLTIME", feedStart: h(8, 30), feedEnd: h(9), closeStart: null, closeEnd: null, sortOrder: 1 },
  { code: "FT_PM", name: "Nhịp chiều", kind: "FULLTIME", feedStart: h(13, 45), feedEnd: h(14), closeStart: h(17, 30), closeEnd: h(18), sortOrder: 2 },
  { code: "P1", name: "Ca P1", kind: "PARTTIME", feedStart: h(7, 50), feedEnd: h(8), closeStart: h(11, 30), closeEnd: h(11, 40), sortOrder: 11 },
  { code: "P2", name: "Ca P2", kind: "PARTTIME", feedStart: h(8, 30), feedEnd: h(8, 45), closeStart: h(12), closeEnd: h(12, 15), sortOrder: 12 },
  { code: "P3", name: "Ca P3", kind: "PARTTIME", feedStart: h(13, 30), feedEnd: h(13, 45), closeStart: h(17), closeEnd: h(17, 30), sortOrder: 13 },
  { code: "P4", name: "Ca P4", kind: "PARTTIME", feedStart: h(13, 45), feedEnd: h(14), closeStart: h(17, 30), closeEnd: h(17, 45), sortOrder: 14 },
  { code: "P5", name: "Ca P5", kind: "PARTTIME", feedStart: h(19), feedEnd: h(19, 15), closeStart: h(22, 15), closeEnd: h(22, 30), sortOrder: 15 },
] as const;

export async function seed(client = prisma) {
  for (const s of SHIFTS) {
    await client.shift.upsert({ where: { code: s.code }, create: { ...s }, update: {} });
  }
  await client.setting.upsert({ where: { key: "rules" }, create: { key: "rules", value: DEFAULT_RULES }, update: {} });
}

if (require.main === module) {
  seed()
    .then(() => console.log("Seed xong: danh mục ca + cấu hình luật mặc định."))
    .finally(() => prisma.$disconnect());
}
