// Rules Engine: mọi con số nghiệp vụ được tham số hóa ở đây, admin chỉnh trong trang Cấu hình.

export type Rules = {
  /** Hệ số xu theo số con đang sống: phần tử i là hệ số khi có i+1 con. */
  coefTable: number[];
  /** Khoá hệ số: true = mỗi lần cho ăn luôn 1 xu (x1), bỏ qua coefTable và kỹ năng Thìn. */
  coefLocked: boolean;
  /** Giá trứng cho con thứ n = eggStep × (n − 1) điểm. */
  eggStep: number;
  /** Mỗi lần trộm lấy stealPercent % số dư ví chủ sân... */
  stealPercent: number;
  /** ...nhưng không quá stealMaxCoins xu. */
  stealMaxCoins: number;
  /** Tối đa số người trộm cho mỗi lần quên đóng cửa. */
  stealMaxThieves: number;
  /** Cửa sổ trộm trong ngày (phút). */
  stealWindowStart: number;
  stealWindowEnd: number;
  /** Phạt mỗi lần con giáp chết (đồng, trừ lương, không liên quan xu). */
  penaltyVnd: number;
  /** Bỏ bữa liên tiếp bao nhiêu lần thì chết. */
  deathStreak: number;
  /** Bỏ bữa bao nhiêu lần trong tháng thì chết. Sau mỗi lần chết đếm lại từ 0. */
  deathMonthly: number;
  /** Tỷ giá tham chiếu 1 xu = coinVnd đồng. */
  coinVnd: number;
  /** Số điểm nhận cho mỗi 1 xu biến động cuối tháng. */
  pointsPerCoin: number;
  /** Thứ mở đăng ký ca part-time (0 = CN ... 5 = T6). */
  registrationWeekday: number;
  /** Số con tối đa trong sân. */
  maxPets: number;
  /** Kỹ năng 12 con giáp: chỉ có tác dụng khi con đó còn sống trong sân. */
  skills: SkillRules;
};

export type SkillRules = {
  /** Mã các con đang bật kỹ năng (TY, SUU, ...). Bỏ mã ra khỏi danh sách = tắt kỹ năng con đó. */
  enabled: string[];
  /** Tý: trần mỗi lần trộm (xu). */
  tyStealMaxCoins: number;
  /** Sửu: xu thưởng mỗi tuần không bỏ bữa nào. */
  suuWeeklyCoins: number;
  /** Dần: số lần quên đóng cửa được canh mỗi tháng. */
  danPerMonth: number;
  /** Mão: số lần đỡ chết mỗi quý (vẫn bị phạt tiền). */
  maoPerQuarter: number;
  /** Thìn: cộng thêm vào hệ số (không vượt hệ số tối đa). */
  thinBonus: number;
  /** Tỵ: sau khi trộm sân bạn 1 lần, người đó bị khoá không trộm được sân bạn trong bấy nhiêu ngày (0 = tắt). */
  tiLockDays: number;
  /** Ngọ: số phút đầu sau khi sân mở cửa mà chỉ người có Ngọ được trộm. */
  ngoPriorityMinutes: number;
  /** Mùi: % bị lấy khi bị trộm (thay cho stealPercent). */
  muiStealPercent: number;
  /** Thân: số lần mỗi tuần được trộm vượt giới hạn số người trộm. */
  thanPerWeek: number;
  /** Dậu: nhắc trước giờ cho ăn bao nhiêu phút. */
  dauRemindMinutes: number;
  /** Tuất: số ngày lễ chung mỗi tháng con tự cho ăn và nhận xu. */
  tuatDaysPerMonth: number;
  /** Hợi: % giảm giá trứng. */
  hoiDiscountPercent: number;
};

export const DEFAULT_RULES: Rules = {
  coefTable: [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 4],
  coefLocked: true,
  eggStep: 20,
  stealPercent: 10,
  stealMaxCoins: 5,
  stealMaxThieves: 3,
  stealWindowStart: 17 * 60 + 30,
  stealWindowEnd: 24 * 60,
  penaltyVnd: 100_000,
  deathStreak: 3,
  deathMonthly: 5,
  coinVnd: 2_000,
  pointsPerCoin: 1,
  registrationWeekday: 5,
  maxPets: 12,
  skills: {
    enabled: ["TY", "SUU", "DAN", "MAO", "THIN", "TI", "NGO", "MUI", "THAN", "DAU", "TUAT", "HOI"],
    tyStealMaxCoins: 6,
    suuWeeklyCoins: 1,
    danPerMonth: 1,
    maoPerQuarter: 1,
    thinBonus: 0.25,
    tiLockDays: 7,
    ngoPriorityMinutes: 10,
    muiStealPercent: 7,
    thanPerWeek: 1,
    dauRemindMinutes: 5,
    tuatDaysPerMonth: 2,
    hoiDiscountPercent: 5,
  },
};

export function mergeRules(partial: unknown): Rules {
  const p = (partial && typeof partial === "object" ? partial : {}) as Partial<Rules>;
  const r = { ...DEFAULT_RULES, ...p };
  r.skills = { ...DEFAULT_RULES.skills, ...(p.skills && typeof p.skills === "object" ? p.skills : {}) };
  if (!Array.isArray(r.skills.enabled)) r.skills.enabled = DEFAULT_RULES.skills.enabled;
  if (!Array.isArray(r.coefTable) || r.coefTable.length < r.maxPets) r.coefTable = DEFAULT_RULES.coefTable;
  return r;
}

/** Xu (cents, 1 xu = 100) nhận được cho 1 lần cho ăn khi sân có `alive` con. `bonus` = cộng thêm hệ số (kỹ năng Thìn). */
export function feedCents(alive: number, rules: Rules = DEFAULT_RULES, bonus = 0): number {
  if (rules.coefLocked) return 100;
  // Giả định: khi tạm thời chưa có con nào (đang chờ cấp lại), vẫn tính hệ số x1.
  const n = Math.max(1, Math.min(alive, rules.maxPets));
  const top = rules.coefTable[rules.maxPets - 1];
  return Math.round(Math.min(rules.coefTable[n - 1] + bonus, top) * 100);
}

/** Giá trứng (điểm) cho con kế tiếp khi đang có `alive` con: con thứ n = eggStep × (n − 1). */
export function eggPrice(alive: number, rules: Rules = DEFAULT_RULES, discountPercent = 0): number {
  const base = rules.eggStep * Math.max(0, alive);
  return discountPercent > 0 ? Math.round((base * (100 - discountPercent)) / 100) : base;
}

/** Số xu (cents) bị lấy trong 1 vụ trộm khi ví chủ sân còn `balanceCents`. */
export function stealCents(
  balanceCents: number,
  rules: Rules = DEFAULT_RULES,
  opts: { percent?: number; maxCoins?: number } = {},
): number {
  if (balanceCents <= 0) return 0;
  const pct = Math.floor((balanceCents * (opts.percent ?? rules.stealPercent)) / 100);
  return Math.max(0, Math.min(pct, (opts.maxCoins ?? rules.stealMaxCoins) * 100));
}

/** Con giáp có chết sau lần bỏ bữa này không. `monthlyMisses` = số bữa bỏ trong tháng kể từ lần chết gần nhất. */
export function shouldDie(streak: number, monthlyMisses: number, rules: Rules = DEFAULT_RULES): boolean {
  return streak >= rules.deathStreak || monthlyMisses >= rules.deathMonthly;
}

/** Quy đổi biến động xu cuối tháng thành điểm: tháng âm tính 0 điểm. */
export function pointsFromNet(netCents: number, rules: Rules = DEFAULT_RULES): number {
  if (netCents <= 0) return 0;
  return Math.floor((netCents * rules.pointsPerCoin) / 100);
}

export type ShiftTimes = { feedStart: number; feedEnd: number; closeStart: number | null; closeEnd: number | null };

/** Hai ca chồng giờ nếu khoảng [vào ca, hết khung ra ca] giao nhau. */
export function shiftsOverlap(a: ShiftTimes, b: ShiftTimes): boolean {
  const aEnd = a.closeEnd ?? a.feedEnd;
  const bEnd = b.closeEnd ?? b.feedEnd;
  return a.feedStart < bEnd && b.feedStart < aEnd;
}

export function inWindow(minutes: number, start: number | null, end: number | null): boolean {
  if (start == null || end == null) return false;
  return minutes >= start && minutes <= end;
}

export function fmtCoins(cents: number): string {
  const v = cents / 100;
  return v.toLocaleString("vi-VN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function fmtVnd(v: number): string {
  return `${v.toLocaleString("vi-VN")} đ`;
}
