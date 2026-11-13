// Mọi mốc giờ tính theo giờ Việt Nam (UTC+7, không có giờ mùa hè).
const OFFSET_MS = 7 * 60 * 60 * 1000;

export type VnNow = {
  day: string; // YYYY-MM-DD
  minutes: number; // phút kể từ 0h
  weekday: number; // 0 = CN, 1 = T2 ... 5 = T6, 6 = T7
  period: string; // YYYY-MM
};

export function vn(now: Date): VnNow {
  const d = new Date(now.getTime() + OFFSET_MS);
  const day = d.toISOString().slice(0, 10);
  return {
    day,
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
    weekday: d.getUTCDay(),
    period: day.slice(0, 7),
  };
}

/** Thời điểm UTC tương ứng với ngày `day` lúc `minutes` phút (giờ VN). */
export function vnInstant(day: string, minutes = 0): Date {
  const base = Date.parse(`${day}T00:00:00.000Z`) - OFFSET_MS;
  return new Date(base + minutes * 60_000);
}

export function addDays(day: string, n: number): string {
  const t = Date.parse(`${day}T00:00:00.000Z`) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export function weekdayOf(day: string): number {
  return new Date(`${day}T00:00:00.000Z`).getUTCDay();
}

export function periodOf(day: string): string {
  return day.slice(0, 7);
}

export function prevPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

export function periodBounds(period: string): { first: string; last: string } {
  const [y, m] = period.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { first: `${period}-01`, last };
}

/** 510 -> "8h30", 1440 -> "24h00" */
export function fmtMin(m: number): string {
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
}

/** "8:30" | "8h30" | "08:30" -> 510 */
export function parseMin(s: string): number {
  const m = s.trim().match(/^(\d{1,2})\s*[:hH]\s*(\d{1,2})?$/);
  if (!m) throw new Error(`Giờ không hợp lệ: ${s}`);
  const v = Number(m[1]) * 60 + Number(m[2] ?? 0);
  if (v < 0 || v > 1440) throw new Error(`Giờ không hợp lệ: ${s}`);
  return v;
}

export const WEEKDAY_VN = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export function fmtDay(day: string): string {
  const [y, m, d] = day.split("-");
  return `${WEEKDAY_VN[weekdayOf(day)]} ${d}/${m}/${y}`;
}

export function fmtDateTime(d: Date | null | undefined): string {
  if (!d) return "";
  const v = new Date(d.getTime() + OFFSET_MS);
  const iso = v.toISOString();
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)} ${iso.slice(11, 16)}`;
}
