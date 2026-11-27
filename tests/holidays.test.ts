import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { lunarToSolar } from "@/lib/lunar";
import { officialHolidays, vnPublicHolidays } from "@/lib/vn-holidays";
import { syncPublicHolidays, skippedPublicHolidays } from "@/server/holidays";
import { addHoliday, removeHoliday, restorePublicHoliday } from "@/server/admin";
import { expectedShifts } from "@/server/schedule";
import { runTick } from "@/server/tick";
import { at, first, makeUser, resetDb } from "./helpers";

const days = (y: number) => vnPublicHolidays(y).map((h) => h.day);

describe("âm lịch", () => {
  it("mùng 1 Tết và Giỗ Tổ 10/3 các năm đã biết", () => {
    expect(lunarToSolar(1, 1, 2024)).toBe("2024-02-10");
    expect(lunarToSolar(1, 1, 2025)).toBe("2025-01-29");
    expect(lunarToSolar(1, 1, 2026)).toBe("2026-02-17");
    expect(lunarToSolar(1, 1, 2027)).toBe("2027-02-06");
    expect(lunarToSolar(1, 1, 2007)).toBe("2007-02-17"); // giờ VN (UTC+7) sớm hơn Trung Quốc 1 ngày
    expect(lunarToSolar(10, 3, 2024)).toBe("2024-04-18");
    expect(lunarToSolar(10, 3, 2025)).toBe("2025-04-07");
    expect(lunarToSolar(10, 3, 2026)).toBe("2026-04-26");
  });

  it("tháng nhuận: 2025 nhuận tháng 6, không có tháng 3 nhuận", () => {
    expect(lunarToSolar(1, 6, 2025, true)).toBe("2025-07-25");
    expect(lunarToSolar(1, 3, 2025, true)).toBeNull();
  });
});

describe("lịch nghỉ lễ nhà nước", () => {
  it("đủ 12 ngày lễ chính thức từ 2026 (11 ngày trước 2026)", () => {
    expect(officialHolidays(2025)).toHaveLength(11);
    expect(officialHolidays(2026)).toHaveLength(12);
  });

  it("2026: Tết 16–20/2, Giỗ Tổ CN 26/4 nghỉ bù T2 27/4, 1–2/9, 24/11", () => {
    const d = days(2026);
    for (const x of ["2026-01-01", "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19", "2026-02-20", "2026-04-26", "2026-04-27", "2026-04-30", "2026-05-01", "2026-09-01", "2026-09-02", "2026-11-24"]) {
      expect(d).toContain(x);
    }
    expect(d).toHaveLength(13);
  });

  it("nghỉ bù vào ngày làm việc kế tiếp chưa là ngày lễ", () => {
    // Tết 2027: mùng 1–2 rơi T7/CN, mùng 3–4 là T2–T3 -> bù T4 10/2 và T5 11/2.
    const h27 = vnPublicHolidays(2027);
    expect(h27.filter((h) => h.compensatory).map((h) => h.day)).toEqual(["2027-02-10", "2027-02-11", "2027-05-03"]);
    // Không ngày nghỉ bù nào rơi vào T7/CN, không trùng ngày.
    for (const y of [2024, 2025, 2026, 2027, 2028, 2029, 2030]) {
      const list = vnPublicHolidays(y);
      expect(new Set(list.map((h) => h.day)).size).toBe(list.length);
      for (const h of list.filter((x) => x.compensatory)) expect([0, 6]).not.toContain(new Date(`${h.day}T00:00:00Z`).getUTCDay());
    }
  });
});

describe("tự nạp ngày lễ", () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.setting.upsert({ where: { key: "rules" }, create: { key: "rules", value: { skills: { enabled: [] } } }, update: { value: { skills: { enabled: [] } } } });
  });

  it("nạp năm nay + năm sau, chạy lại không trùng", async () => {
    const n = await syncPublicHolidays(at("2026-11-27", "7:00"));
    expect(n).toBe(days(2026).length + days(2027).length);
    expect(await syncPublicHolidays(at("2026-11-27", "7:05"))).toBe(0);
    const h = await prisma.holiday.findUniqueOrThrow({ where: { day: "2027-02-06" } });
    expect(h).toMatchObject({ source: "AUTO", name: "Tết Nguyên đán (mùng 1)" });
  });

  it("ngày lễ không có lượt cho ăn, không tính bỏ bữa", async () => {
    await syncPublicHolidays(at("2026-11-23", "6:00"));
    const u = await makeUser("a@x.com", "FULLTIME", at("2026-11-23", "7:00"));
    expect(await expectedShifts(u, "2026-11-24")).toHaveLength(0);
    await runTick(at("2026-11-25", "7:00"), first);
    const missed = await prisma.attendance.findMany({ where: { userId: u.id, feedStatus: "MISSED" } });
    expect(missed.map((m) => m.day)).toEqual(["2026-11-23", "2026-11-23"]);
  });

  it("admin xoá ngày lễ tự động thì không bị nạp lại; khôi phục được", async () => {
    const admin = await makeUser("admin@x.com", "ADMIN", new Date());
    await syncPublicHolidays(at("2026-11-23", "6:00"));
    await removeHoliday(admin.id, "2026-11-24");
    await syncPublicHolidays(at("2026-11-23", "6:05"));
    expect(await prisma.holiday.findUnique({ where: { day: "2026-11-24" } })).toBeNull();
    expect((await skippedPublicHolidays(2026)).map((h) => h.day)).toEqual(["2026-11-24"]);
    await restorePublicHoliday(admin.id, "2026-11-24");
    expect(await prisma.holiday.findUnique({ where: { day: "2026-11-24" } })).toMatchObject({ source: "AUTO" });
    expect(await skippedPublicHolidays(2026)).toHaveLength(0);
  });

  it("admin thêm ngày nghỉ bù / sửa tên: giữ nguyên khi nạp lại", async () => {
    const admin = await makeUser("admin@x.com", "ADMIN", new Date());
    await syncPublicHolidays(at("2026-11-23", "6:00"));
    await addHoliday(admin.id, "2026-12-31", "Nghỉ hoán đổi Tết Dương lịch");
    await addHoliday(admin.id, "2026-11-24", "Ngày Văn hoá (công ty)");
    await syncPublicHolidays(at("2026-11-23", "6:05"));
    expect(await prisma.holiday.findUnique({ where: { day: "2026-12-31" } })).toMatchObject({ source: "MANUAL" });
    expect(await prisma.holiday.findUnique({ where: { day: "2026-11-24" } })).toMatchObject({ source: "MANUAL", name: "Ngày Văn hoá (công ty)" });
    // Xoá ngày admin thêm (không phải lễ nhà nước) thì không cần ghi nhớ.
    await removeHoliday(admin.id, "2026-12-31");
    expect(await prisma.holidaySkip.count()).toBe(0);
  });
});
