import type { Zodiac } from "@prisma/client";

// Mỗi con giáp có hình ảnh cố định, giống nhau với mọi người.
export const ZODIAC: Record<Zodiac, { name: string; emoji: string; order: number }> = {
  TY: { name: "Tý", emoji: "🐭", order: 1 },
  SUU: { name: "Sửu", emoji: "🐮", order: 2 },
  DAN: { name: "Dần", emoji: "🐯", order: 3 },
  MAO: { name: "Mão", emoji: "🐱", order: 4 },
  THIN: { name: "Thìn", emoji: "🐲", order: 5 },
  TI: { name: "Tỵ", emoji: "🐍", order: 6 },
  NGO: { name: "Ngọ", emoji: "🐴", order: 7 },
  MUI: { name: "Mùi", emoji: "🐐", order: 8 },
  THAN: { name: "Thân", emoji: "🐵", order: 9 },
  DAU: { name: "Dậu", emoji: "🐔", order: 10 },
  TUAT: { name: "Tuất", emoji: "🐶", order: 11 },
  HOI: { name: "Hợi", emoji: "🐷", order: 12 },
};

export const ALL_ZODIAC = Object.keys(ZODIAC) as Zodiac[];

/** Ảnh cố định (đã tách nền) của từng con giáp, nằm trong public/zodiac. */
export function zodiacImage(z: Zodiac): string {
  return `/zodiac/${z.toLowerCase()}.webp`;
}

/** Vị trí "cổ" (tỉ lệ từ trên xuống) để tách đầu khi làm hiệu ứng chibi. */
export const ZODIAC_NECK: Record<Zodiac, number> = {
  TY: 0.6, SUU: 0.45, DAN: 0.5, MAO: 0.55, THIN: 0.5, TI: 0.5,
  NGO: 0.45, MUI: 0.52, THAN: 0.55, DAU: 0.52, TUAT: 0.56, HOI: 0.6,
};
