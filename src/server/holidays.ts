import { prisma, type Tx } from "@/lib/db";
import { vn } from "@/lib/time";
import { vnPublicHolidays } from "@/lib/vn-holidays";

/**
 * Tự nạp lịch nghỉ lễ nhà nước (năm nay + năm sau) vào bảng Holiday. Idempotent:
 *  - không ghi đè ngày admin đã thêm/sửa,
 *  - không nạp lại ngày admin đã xoá (HolidaySkip).
 * Trả về số ngày mới được thêm.
 */
export async function syncPublicHolidays(now = new Date(), tx: Tx = prisma): Promise<number> {
  const y = Number(vn(now).day.slice(0, 4));
  const wanted = [...vnPublicHolidays(y), ...vnPublicHolidays(y + 1)];
  const days = wanted.map((h) => h.day);
  const [existing, skipped] = await Promise.all([
    tx.holiday.findMany({ where: { day: { in: days } }, select: { day: true } }),
    tx.holidaySkip.findMany({ where: { day: { in: days } }, select: { day: true } }),
  ]);
  const has = new Set([...existing, ...skipped].map((h) => h.day));
  const seen = new Set<string>();
  const data = wanted.filter((h) => !has.has(h.day) && !seen.has(h.day) && seen.add(h.day)).map((h) => ({ day: h.day, name: h.name, source: "AUTO" }));
  if (!data.length) return 0;
  const r = await tx.holiday.createMany({ data, skipDuplicates: true });
  return r.count;
}

/** Các ngày lễ tự động của `year` mà admin đã xoá (để hiện nút khôi phục). */
export async function skippedPublicHolidays(year: number) {
  const list = vnPublicHolidays(year);
  const skipped = await prisma.holidaySkip.findMany({ where: { day: { in: list.map((h) => h.day) } } });
  const set = new Set(skipped.map((s) => s.day));
  return list.filter((h) => set.has(h.day));
}
