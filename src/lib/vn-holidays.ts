// Lịch nghỉ lễ nhà nước Việt Nam (Điều 112 Bộ luật Lao động 2019, bổ sung Ngày Văn hoá Việt Nam 24/11 từ 2026).
// Tự tính theo năm, kể cả ngày âm lịch, nên không cần admin nhập tay mỗi năm.
import { lunarToSolar } from "./lunar";
import { addDays, weekdayOf } from "./time";

export type PublicHoliday = { day: string; name: string; compensatory?: boolean };

/** Năm bắt đầu có ngày nghỉ Ngày Văn hoá Việt Nam (24/11). */
export const CULTURE_DAY_FROM = 2026;

const ymd = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const isWeekend = (day: string) => {
  const wd = weekdayOf(day);
  return wd === 0 || wd === 6;
};

/**
 * Ngày liền kề Quốc khánh 2/9 (Thủ tướng chọn hằng năm, trước hoặc sau 2/9).
 * Chọn sao cho nối được với cuối tuần, giống cách các năm gần đây đã chọn.
 */
function nationalDayAdjacent(y: number): string {
  const wd = weekdayOf(ymd(y, 9, 2));
  // 2/9 rơi vào CN, T2, T5 -> nghỉ thêm 3/9; còn lại -> 1/9
  return wd === 0 || wd === 1 || wd === 4 ? ymd(y, 9, 3) : ymd(y, 9, 1);
}

/** Các ngày lễ chính thức (chưa tính nghỉ bù) của năm dương lịch `y`. */
export function officialHolidays(y: number): PublicHoliday[] {
  const list: PublicHoliday[] = [{ day: ymd(y, 1, 1), name: "Tết Dương lịch" }];

  // Tết Nguyên đán: ngày cuối năm âm lịch + mùng 1..4 tháng Giêng (5 ngày).
  const tet = lunarToSolar(1, 1, y)!;
  list.push({ day: addDays(tet, -1), name: "Tết Nguyên đán (cuối năm)" });
  for (let i = 0; i < 4; i++) list.push({ day: addDays(tet, i), name: `Tết Nguyên đán (mùng ${i + 1})` });

  list.push({ day: lunarToSolar(10, 3, y)!, name: "Giỗ Tổ Hùng Vương (10/3 âm lịch)" });
  list.push({ day: ymd(y, 4, 30), name: "Ngày Chiến thắng 30/4" });
  list.push({ day: ymd(y, 5, 1), name: "Quốc tế Lao động 1/5" });
  list.push({ day: ymd(y, 9, 2), name: "Quốc khánh 2/9" });
  list.push({ day: nationalDayAdjacent(y), name: "Quốc khánh (ngày liền kề)" });
  if (y >= CULTURE_DAY_FROM) list.push({ day: ymd(y, 11, 24), name: "Ngày Văn hoá Việt Nam 24/11" });

  return list.sort((a, b) => a.day.localeCompare(b.day));
}

/**
 * Toàn bộ ngày nghỉ lễ của năm `y`, gồm cả nghỉ bù:
 * ngày lễ trùng T7/CN thì được nghỉ bù vào ngày làm việc (T2–T6) kế tiếp chưa phải ngày lễ.
 * Ngày nghỉ bù có thể rơi sang đầu năm sau (vd lễ 30/12 âm lịch); vẫn trả về trong danh sách năm `y`.
 */
export function vnPublicHolidays(y: number): PublicHoliday[] {
  const official = officialHolidays(y);
  const taken = new Set(official.map((h) => h.day));
  // Ngày lễ đầu năm sau cũng chặn ngày nghỉ bù (tránh bù trùng lễ năm sau).
  for (const h of officialHolidays(y + 1)) taken.add(h.day);
  const out: PublicHoliday[] = [...official];
  for (const h of official) {
    if (!isWeekend(h.day)) continue;
    let d = addDays(h.day, 1);
    while (isWeekend(d) || taken.has(d)) d = addDays(d, 1);
    taken.add(d);
    out.push({ day: d, name: `Nghỉ bù ${h.name}`, compensatory: true });
  }
  return out.sort((a, b) => a.day.localeCompare(b.day));
}
