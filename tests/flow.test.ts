import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { feed, closeYard } from "@/server/attendance";
import { runTick } from "@/server/tick";
import { steal, stealableYards } from "@/server/theft";
import { buyEgg, movePet } from "@/server/yard";
import { approveUser, requestLeave, reviewLeave, adjustPoints, addHoliday } from "@/server/admin";
import { saveMyRegistrations, adminSetRegistrations } from "@/server/schedule";
import { settleMonth, computeMonth } from "@/server/settlement";
import { coinBalance, pointBalance } from "@/server/wallet";
import { at, first, makeUser, resetDb } from "./helpers";

// Tuần dùng để thử: T2 16/11/2026 .. CN 22/11/2026. Thứ Sáu 13/11 là ngày mở đăng ký.
const MON = "2026-11-16", TUE = "2026-11-17", WED = "2026-11-18", THU = "2026-11-19", FRI = "2026-11-20", SAT = "2026-11-21";

beforeEach(resetDb);

async function alive(userId: string) {
  return prisma.pet.count({ where: { userId, status: "ALIVE" } });
}

describe("duyệt tài khoản", () => {
  it("admin duyệt -> active + cấp con đầu miễn phí", async () => {
    const admin = await makeUser("admin@x.com", "ADMIN", new Date());
    const u = await prisma.user.create({ data: { email: "a@x.com" } });
    expect(u.status).toBe("PENDING");
    await approveUser(admin.id, u.id, "FULLTIME", at(MON, "7:00"));
    const pets = await prisma.pet.findMany({ where: { userId: u.id } });
    expect(pets).toHaveLength(1);
    expect(pets[0].source).toBe("FREE");
    expect(await alive(admin.id)).toBe(0);
  });
});

describe("full-time: cho ăn, đóng cửa, bỏ bữa", () => {
  it("cho ăn trong khung được 1 xu, ngoài khung bị từ chối, cho ăn 2 lần bị từ chối", async () => {
    const admin = await makeUser("admin@x.com", "ADMIN", new Date());
    const u = await prisma.user.create({ data: { email: "a@x.com" } });
    await approveUser(admin.id, u.id, "FULLTIME", at(MON, "7:00"));
    await expect(feed(u.id, at(MON, "8:20"))).rejects.toThrow(/Chưa tới giờ/);
    const r = await feed(u.id, at(MON, "8:40"), { ip: "1.2.3.4" });
    expect(r.cents).toBe(100);
    await expect(feed(u.id, at(MON, "8:50"))).rejects.toThrow(/đã cho ăn/);
    await feed(u.id, at(MON, "14:00"));
    expect(await coinBalance(u.id)).toBe(200);
    await expect(closeYard(u.id, at(MON, "17:00"))).rejects.toThrow(/Chưa tới giờ đóng cửa/);
    await closeYard(u.id, at(MON, "17:45"));
    const slots = await prisma.attendance.findMany({ where: { userId: u.id, day: MON } });
    expect(slots.every((s) => s.feedStatus === "FED")).toBe(true);
    expect(slots.find((s) => s.closeStatus === "CLOSED")?.closeAt).toBeTruthy();
    expect(slots.find((s) => s.feedIp)?.feedIp).toBe("1.2.3.4");
  });

  it("T7/CN không tạo lượt cho full-time", async () => {
    const u = await makeUser("a@x.com", "FULLTIME", at(MON, "7:00"));
    await runTick(at(SAT, "23:00"), first);
    const satSlots = await prisma.attendance.count({ where: { userId: u.id, day: SAT } });
    expect(satSlots).toBe(0);
  });

  it("bỏ 3 bữa liên tiếp -> chết 1 con, phạt 300k, có 1 con thì hôm sau cấp con mới", async () => {
    const u = await makeUser("a@x.com", "FULLTIME", at(MON, "7:00"));
    await runTick(at(MON, "7:01"), first); // cấp con đầu
    expect(await alive(u.id)).toBe(1);
    await feed(u.id, at(MON, "8:40"));
    await runTick(at(TUE, "9:10"), first); // bỏ chiều T2, sáng T3 -> streak 2
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).missStreak).toBe(2);
    expect(await alive(u.id)).toBe(1);
    await runTick(at(TUE, "14:10"), first); // bỏ chiều T3 -> streak 3 -> chết
    expect(await alive(u.id)).toBe(0);
    const pen = await prisma.penalty.findMany({ where: { userId: u.id } });
    expect(pen).toHaveLength(1);
    expect(pen[0].amountVnd).toBe(300000);
    expect(await coinBalance(u.id)).toBe(100); // phạt không trừ xu
    const user = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(user.missStreak).toBe(0);
    expect(user.regrantOn).toBe(WED);
    await runTick(at(WED, "6:00"), first);
    const pets = await prisma.pet.findMany({ where: { userId: u.id, status: "ALIVE" } });
    expect(pets).toHaveLength(1);
    expect(pets[0].source).toBe("REGRANT");
  });

  it("cho ăn thành công reset bộ đếm liên tiếp; bỏ lần thứ 5 trong tháng thì chết, lần 6 chết tiếp", async () => {
    const u = await makeUser("a@x.com", "FULLTIME", at(MON, "7:00"));
    await runTick(at(MON, "7:01"), first);
    // cho 3 con để thấy chết liên tiếp
    await adjustPoints(u.id, u.id, 1000, "test");
    await buyEgg(u.id, undefined, at(MON, "7:05"), first);
    await buyEgg(u.id, undefined, at(MON, "7:06"), first);
    expect(await alive(u.id)).toBe(3);
    // Mỗi ngày: bỏ sáng, cho ăn chiều -> streak không bao giờ tới 3
    for (const d of [MON, TUE, WED, THU]) {
      await runTick(at(d, "9:05"), first);
      await feed(u.id, at(d, "13:50"));
    }
    expect(await alive(u.id)).toBe(3); // 4 lần bỏ trong tháng
    await runTick(at(FRI, "9:05"), first); // lần 5
    expect(await alive(u.id)).toBe(2);
    await runTick(at(FRI, "14:05"), first); // lần 6 (streak 2)
    expect(await alive(u.id)).toBe(1);
    expect(await prisma.penalty.count({ where: { userId: u.id } })).toBe(2);
  });

  it("hệ số xu theo số con sống", async () => {
    const u = await makeUser("a@x.com", "FULLTIME", at(MON, "7:00"));
    await runTick(at(MON, "7:01"), first);
    await adjustPoints(u.id, u.id, 20, "test");
    await buyEgg(u.id, undefined, at(MON, "7:05"), first);
    const r = await feed(u.id, at(MON, "8:31"));
    expect(r.cents).toBe(125);
  });

  it("ngày nghỉ phép đã duyệt và ngày lễ: không có lượt, không bỏ bữa", async () => {
    const admin = await makeUser("admin@x.com", "ADMIN", new Date());
    const u = await makeUser("a@x.com", "FULLTIME", at(MON, "7:00"));
    const l = await requestLeave(u.id, "LEAVE", TUE, TUE, "việc riêng");
    await reviewLeave(admin.id, l.id, true);
    await addHoliday(admin.id, WED, "Lễ");
    await runTick(at(THU, "7:00"), first);
    const missed = await prisma.attendance.findMany({ where: { userId: u.id, feedStatus: "MISSED" } });
    expect(missed.map((m) => m.day).sort()).toEqual([MON, MON]);
  });
});

describe("part-time: đăng ký ca thứ Sáu", () => {
  it("chỉ mở thứ Sáu, chặn trùng ca, sau khi khóa chỉ admin đổi hộ", async () => {
    const admin = await makeUser("admin@x.com", "ADMIN", new Date());
    const u = await makeUser("p@x.com", "PARTTIME", at("2026-11-10", "7:00"));
    const shifts = await prisma.shift.findMany();
    const id = (c: string) => shifts.find((s) => s.code === c)!.id;
    const fri = at("2026-11-13", "10:00");
    await expect(saveMyRegistrations(u.id, [{ day: MON, shiftId: id("P1") }, { day: MON, shiftId: id("P2") }], fri)).rejects.toThrow(/chồng giờ/);
    await expect(saveMyRegistrations(u.id, [{ day: MON, shiftId: id("FT_AM") }], fri)).rejects.toThrow(/Ca không hợp lệ/);
    await saveMyRegistrations(u.id, [{ day: MON, shiftId: id("P2") }, { day: MON, shiftId: id("P3") }, { day: SAT, shiftId: id("P5") }], fri);
    await expect(saveMyRegistrations(u.id, [], at("2026-11-14", "0:01"))).rejects.toThrow(/thứ Sáu/);
    await expect(saveMyRegistrations(u.id, [{ day: "2026-11-23", shiftId: id("P1") }], fri)).rejects.toThrow(/không thuộc tuần/);
    // Admin đổi hộ: bỏ ca T7
    await expect(adminSetRegistrations(admin.id, u.id, MON, [], "")).rejects.toThrow(/lý do/);
    await adminSetRegistrations(admin.id, u.id, MON, [{ day: MON, shiftId: id("P2") }, { day: MON, shiftId: id("P3") }], "đổi lịch");
    await runTick(at("2026-11-22", "23:00"), first);
    const slots = await prisma.attendance.findMany({ where: { userId: u.id }, include: { shift: true } });
    expect(slots.map((s) => `${s.day}:${s.shift.code}:${s.feedStatus}`).sort()).toEqual([`${MON}:P2:MISSED`, `${MON}:P3:MISSED`]);
  });
});

describe("trộm xu khi quên đóng cửa", () => {
  it("17h30–24h, 10% tối đa 5 xu, tối đa 3 người, không tự trộm", async () => {
    const victim = await makeUser("v@x.com", "FULLTIME", at("2026-11-02", "7:00"));
    const thieves = await Promise.all(["t1", "t2", "t3", "t4"].map((n) => makeUser(`${n}@x.com`, "FULLTIME", at("2026-11-02", "7:00"))));
    await prisma.coinLedger.create({ data: { userId: victim.id, amount: 2000, type: "ADJUST", period: "2026-11", reason: "số dư thử" } }); // 20 xu
    await feed(victim.id, at(MON, "8:40")); // 21 xu, sau đó quên đóng cửa
    await runTick(at(MON, "17:20"), first);
    expect(await stealableYards(thieves[0].id, at(MON, "17:20"))).toHaveLength(0);
    await runTick(at(MON, "18:01"), first);
    const slot = await prisma.attendance.findFirstOrThrow({ where: { userId: victim.id, day: MON, closeStatus: "FORGOT" } });
    expect(await stealableYards(victim.id, at(MON, "18:05"))).toHaveLength(0);
    await expect(steal(victim.id, slot.id, at(MON, "18:05"))).rejects.toThrow(/tự trộm/);
    const list = await stealableYards(thieves[0].id, at(MON, "18:05"));
    expect(list).toHaveLength(1);
    expect(list[0].amount).toBe(210);
    const a = await steal(thieves[0].id, slot.id, at(MON, "18:05"));
    expect(a.amount).toBe(210); // 10% của 21
    await expect(steal(thieves[0].id, slot.id, at(MON, "18:06"))).rejects.toThrow(/đã trộm/);
    const b = await steal(thieves[1].id, slot.id, at(MON, "18:07"));
    expect(b.amount).toBe(189); // 10% của 18,9
    await steal(thieves[2].id, slot.id, at(MON, "18:08"));
    await expect(steal(thieves[3].id, slot.id, at(MON, "18:09"))).rejects.toThrow(/đủ số lần/);
    expect(await coinBalance(thieves[0].id)).toBe(210);
    const bal = await coinBalance(victim.id);
    expect(bal).toBe(2100 - 210 - 189 - 170);
    // Hết ngày thì đóng cửa sổ trộm
    await expect(steal(thieves[3].id, slot.id, at(TUE, "0:10"))).rejects.toThrow();
  });

  it("trộm song song không vượt quá 3 người", async () => {
    const victim = await makeUser("v@x.com", "FULLTIME", at("2026-11-02", "7:00"));
    const thieves = await Promise.all([1, 2, 3, 4, 5, 6].map((n) => makeUser(`t${n}@x.com`, "PARTTIME", at("2026-11-02", "7:00"))));
    await prisma.coinLedger.create({ data: { userId: victim.id, amount: 10000, type: "ADJUST", period: "2026-11" } });
    await feed(victim.id, at(MON, "8:40"));
    await runTick(at(MON, "18:01"), first);
    const slot = await prisma.attendance.findFirstOrThrow({ where: { userId: victim.id, closeStatus: "FORGOT" } });
    const results = await Promise.allSettled(thieves.map((t) => steal(t.id, slot.id, at(MON, "19:00"))));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    expect(await prisma.theft.count()).toBe(3);
  });

  it("không đi làm cả ngày thì không bị tính quên đóng cửa", async () => {
    const u = await makeUser("v@x.com", "FULLTIME", at("2026-11-02", "7:00"));
    await runTick(at(MON, "18:30"), first);
    const s = await prisma.attendance.findMany({ where: { userId: u.id, day: MON } });
    expect(s.find((x) => x.closeStatus === "SKIPPED")).toBeTruthy();
  });
});

describe("trứng & sân", () => {
  it("không đủ điểm bị từ chối, nở không trùng, tối đa 12, đổi chỗ", async () => {
    const u = await makeUser("a@x.com", "FULLTIME", at(MON, "7:00"));
    await runTick(at(MON, "7:01"));
    await expect(buyEgg(u.id, undefined, at(MON, "7:02"))).rejects.toThrow(/Chưa đủ điểm/);
    await adjustPoints(u.id, u.id, 1320, "đủ bộ");
    for (let i = 0; i < 11; i++) await buyEgg(u.id, undefined, at(MON, "7:03"));
    const pets = await prisma.pet.findMany({ where: { userId: u.id, status: "ALIVE" } });
    expect(pets).toHaveLength(12);
    expect(new Set(pets.map((p) => p.zodiac)).size).toBe(12);
    expect(new Set(pets.map((p) => p.slot)).size).toBe(12);
    expect(await pointBalance(u.id)).toBe(0);
    await expect(buyEgg(u.id, undefined, at(MON, "7:04"))).rejects.toThrow(/đủ 12/);
    const [p0, p1] = pets.sort((a, b) => a.slot - b.slot);
    await movePet(u.id, p0.id, p1.slot);
    const moved = await prisma.pet.findMany({ where: { id: { in: [p0.id, p1.id] } } });
    expect(moved.find((p) => p.id === p0.id)!.slot).toBe(p1.slot);
    expect(moved.find((p) => p.id === p1.id)!.slot).toBe(p0.slot);
    const r = await feed(u.id, at(MON, "8:45"));
    expect(r.cents).toBe(400);
  });
});

describe("quyết toán tháng", () => {
  it("biến động = cho ăn + trộm được − bị trộm; tháng âm 0 điểm; chạy lại không trùng; tiêu điểm không đổi báo cáo", async () => {
    const a = await makeUser("a@x.com", "FULLTIME", at("2026-11-02", "7:00"));
    const b = await makeUser("b@x.com", "FULLTIME", at("2026-11-02", "7:00"));
    await prisma.coinLedger.createMany({
      data: [
        { userId: a.id, amount: 4400, type: "FEED", period: "2026-11" },
        { userId: a.id, amount: 300, type: "STEAL_GAIN", period: "2026-11" },
        { userId: a.id, amount: -150, type: "STEAL_LOSS", period: "2026-11" },
        { userId: b.id, amount: -500, type: "STEAL_LOSS", period: "2026-11" },
        { userId: a.id, amount: 999, type: "FEED", period: "2026-10" },
      ],
    });
    const stats = await runTick(at("2026-12-01", "0:05"), first);
    expect(stats.settled).toBeGreaterThan(0);
    const rows = await computeMonth("2026-11");
    const ra = rows.find((r) => r.userId === a.id)!;
    expect(ra.netCoins).toBe(4550);
    expect(ra.points).toBe(45);
    expect(ra.rewardVnd).toBe(91000);
    expect(rows.find((r) => r.userId === b.id)!.points).toBe(0);
    expect(await pointBalance(a.id)).toBe(45);
    expect(await settleMonth("2026-11")).toBe(0);
    expect(await pointBalance(a.id)).toBe(45);
    const { price } = await buyEgg(a.id, undefined, at("2026-12-01", "9:00"));
    const after = await computeMonth("2026-11");
    expect(after.find((r) => r.userId === a.id)!.netCoins).toBe(4550);
    expect(await pointBalance(a.id)).toBe(45 - price);
    expect(await coinBalance(a.id)).toBe(4550 + 999); // ví xu không về 0
  });
});
