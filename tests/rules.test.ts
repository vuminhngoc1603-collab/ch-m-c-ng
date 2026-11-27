import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, eggPrice, feedCents, pointsFromNet, shiftsOverlap, shouldDie, stealCents } from "@/lib/rules";
import { addDays, fmtMin, periodBounds, prevPeriod, vn, vnInstant } from "@/lib/time";

describe("hệ số xu", () => {
  it("mặc định khoá hệ số: luôn 1 xu, Thìn vẫn +0,25", () => {
    expect(DEFAULT_RULES.coefLocked).toBe(true);
    for (const n of [0, 1, 2, 5, 12]) expect(feedCents(n)).toBe(100);
    expect(feedCents(3, DEFAULT_RULES, 0.25)).toBe(125);
    expect(feedCents(12, DEFAULT_RULES, 0.25)).toBe(125);
  });

  it("mở khoá: 1 con x1, mỗi con thêm +0,25, con thứ 12 x4", () => {
    const open = { ...DEFAULT_RULES, coefLocked: false };
    expect(feedCents(1, open)).toBe(100);
    expect(feedCents(2, open)).toBe(125);
    expect(feedCents(5, open)).toBe(200);
    expect(feedCents(11, open)).toBe(350);
    expect(feedCents(12, open)).toBe(400);
    expect(feedCents(20, open)).toBe(400);
    expect(feedCents(0, open)).toBe(100);
  });
});

describe("giá trứng", () => {
  it("con thứ n giá 20 × (n − 1) điểm, tổng 12 con 1.320", () => {
    expect(eggPrice(1)).toBe(20);
    expect(eggPrice(2)).toBe(40);
    expect(eggPrice(11)).toBe(220);
    let total = 0;
    for (let alive = 1; alive < 12; alive++) total += eggPrice(alive);
    expect(total).toBe(1320);
  });
});

describe("trộm xu", () => {
  it("10% số dư, tối đa 5 xu", () => {
    expect(stealCents(1000)).toBe(100); // 10 xu -> 1 xu
    expect(stealCents(4400)).toBe(440); // 44 xu -> 4,4 xu
    expect(stealCents(17600)).toBe(500); // 176 xu -> trần 5 xu
    expect(stealCents(0)).toBe(0);
    expect(stealCents(-300)).toBe(0);
  });
});

describe("chết", () => {
  it("3 lần liên tiếp hoặc từ lần thứ 5 trong tháng", () => {
    expect(shouldDie(2, 2)).toBe(false);
    expect(shouldDie(3, 3)).toBe(true);
    expect(shouldDie(1, 4)).toBe(false);
    expect(shouldDie(1, 5)).toBe(true);
    expect(shouldDie(1, 6)).toBe(true);
  });
});

describe("điểm", () => {
  it("1 xu = 1 điểm, tháng âm = 0", () => {
    expect(pointsFromNet(4450)).toBe(44);
    expect(pointsFromNet(-500)).toBe(0);
  });
});

describe("trùng ca", () => {
  const P1 = { feedStart: 470, feedEnd: 480, closeStart: 690, closeEnd: 700 };
  const P2 = { feedStart: 510, feedEnd: 525, closeStart: 720, closeEnd: 735 };
  const P3 = { feedStart: 810, feedEnd: 825, closeStart: 1020, closeEnd: 1050 };
  const P4 = { feedStart: 825, feedEnd: 840, closeStart: 1050, closeEnd: 1065 };
  it("P1-P2 và P3-P4 chồng giờ, P2-P3 không", () => {
    expect(shiftsOverlap(P1, P2)).toBe(true);
    expect(shiftsOverlap(P3, P4)).toBe(true);
    expect(shiftsOverlap(P2, P3)).toBe(false);
  });
});

describe("giờ Việt Nam", () => {
  it("quy đổi đúng UTC+7", () => {
    const t = vnInstant("2026-11-13", 8 * 60 + 30);
    expect(t.toISOString()).toBe("2026-11-13T01:30:00.000Z");
    const v = vn(new Date("2026-11-13T17:30:00Z"));
    expect(v.day).toBe("2026-11-14");
    expect(v.minutes).toBe(30);
    expect(v.weekday).toBe(6);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(prevPeriod("2027-01")).toBe("2026-12");
    expect(periodBounds("2026-02").last).toBe("2026-02-28");
    expect(fmtMin(1440)).toBe("24h00");
  });
});
