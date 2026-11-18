import { beforeEach, describe, expect, it } from "vitest";
import type { Zodiac } from "@prisma/client";
import { prisma } from "@/lib/db";
import { feed } from "@/server/attendance";
import { runTick } from "@/server/tick";
import { steal, stealableYards } from "@/server/theft";
import { buyEgg, killRandomPet } from "@/server/yard";
import { computeMonth } from "@/server/settlement";
import { getRules } from "@/server/settings";
import { coinBalance, pointBalance } from "@/server/wallet";
import { at, first, makeUser, resetDb } from "./helpers";

const MON = "2026-11-16", TUE = "2026-11-17", WED = "2026-11-18", THU = "2026-11-19";
const EARLY = at("2026-11-02", "7:00");

beforeEach(resetDb);

/** Cho người dùng đúng các con giáp này (con trung tính DAU nếu không truyền). */
async function give(userId: string, zodiacs: Zodiac[]) {
  for (const [i, z] of zodiacs.entries()) {
    await prisma.pet.create({ data: { userId, zodiac: z, slot: i, source: "EGG", acquiredAt: EARLY } });
  }
}

async function staff(email: string, zodiacs: Zodiac[] = ["DAU"], role: "FULLTIME" | "PARTTIME" = "FULLTIME", approved = at(MON, "7:00")) {
  const u = await makeUser(email, role, approved);
  await give(u.id, zodiacs);
  return u;
}

async function coins(userId: string, xu: number) {
  await prisma.coinLedger.create({ data: { userId, amount: xu * 100, type: "ADJUST", period: "2026-11", reason: "số dư thử" } });
}

/** Chủ sân cho ăn sáng thứ Hai rồi quên đóng cửa; trả về lượt quên. */
async function forgetful(victimId: string, day = MON) {
  await feed(victimId, at(day, "8:40"));
  await runTick(at(day, "18:01"), first);
  return prisma.attendance.findFirstOrThrow({ where: { userId: victimId, day, closeStatus: "FORGOT" } });
}

describe("kỹ năng xu", () => {
  it("Thìn: hệ số +0,25 nhưng không vượt x4", async () => {
    const a = await staff("a@x.com", ["THIN"]);
    const r = await feed(a.id, at(MON, "8:40"));
    expect(r.cents).toBe(125); // 1 con x1 + 0,25
    const all: Zodiac[] = ["TY", "SUU", "DAN", "MAO", "THIN", "TI", "NGO", "MUI", "THAN", "DAU", "TUAT", "HOI"];
    const b = await staff("b@x.com", all);
    expect((await feed(b.id, at(MON, "8:41"))).cents).toBe(400);
  });

  it("Hợi: trứng giảm 5%", async () => {
    const a = await staff("a@x.com", ["HOI", "DAU"]); // con thứ 3 giá gốc 40
    await prisma.pointLedger.create({ data: { userId: a.id, amount: 100, type: "ADJUST", reason: "thử" } });
    const r = await buyEgg(a.id, undefined, at(MON, "7:00"), first);
    expect(r.price).toBe(38);
    expect(await pointBalance(a.id)).toBe(62);
  });

  it("Sửu: tuần không bỏ bữa được +1 xu, chạy lại không cộng trùng, có tính vào biến động tháng", async () => {
    const a = await staff("a@x.com", ["SUU"], "PARTTIME");
    const p2 = await prisma.shift.findUniqueOrThrow({ where: { code: "P2" } });
    await prisma.shiftRegistration.create({ data: { userId: a.id, day: MON, shiftId: p2.id, createdById: a.id } });
    await feed(a.id, at(MON, "8:35"));
    await runTick(at("2026-11-23", "9:00"), first);
    await runTick(at("2026-11-23", "9:05"), first);
    const skill = await prisma.coinLedger.findMany({ where: { userId: a.id, type: "SKILL" } });
    expect(skill.map((s) => s.amount)).toEqual([100]);
    const row = (await computeMonth("2026-11")).find((r) => r.userId === a.id)!;
    expect(row.skillCoins).toBe(100);
    expect(row.netCoins).toBe(row.feedCoins + 100);
  });

  it("Sửu: tuần có bỏ bữa thì không được thưởng", async () => {
    const a = await staff("a@x.com", ["SUU", "DAU"], "PARTTIME");
    const p2 = await prisma.shift.findUniqueOrThrow({ where: { code: "P2" } });
    for (const d of [MON, TUE]) await prisma.shiftRegistration.create({ data: { userId: a.id, day: d, shiftId: p2.id, createdById: a.id } });
    await feed(a.id, at(MON, "8:35")); // thứ Ba bỏ bữa
    await runTick(at("2026-11-23", "9:00"), first);
    expect(await prisma.coinLedger.count({ where: { userId: a.id, type: "SKILL" } })).toBe(0);
  });

  it("Tuất: ngày lễ chung tự cho ăn, nhận xu như đi làm", async () => {
    const a = await staff("a@x.com", ["TUAT"], "FULLTIME", at(WED, "7:00"));
    await prisma.holiday.create({ data: { day: WED, name: "Lễ thử" } });
    await runTick(at(THU, "7:00"), first);
    await runTick(at(THU, "7:05"), first);
    const s = await prisma.coinLedger.findMany({ where: { userId: a.id, type: "SKILL" } });
    expect(s.map((x) => x.amount)).toEqual([200]); // 2 nhịp full-time × 1 xu
  });
});

describe("kỹ năng phòng thủ", () => {
  it("Mão: đỡ chết 1 lần mỗi quý nhưng vẫn phạt 300k", async () => {
    const a = await staff("a@x.com", ["MAO", "DAU"]);
    const rules = await getRules();
    const r1 = await prisma.$transaction((tx) => killRandomPet(tx, a.id, "thử", rules, at(MON, "9:01"), first, MON));
    expect(r1).toBeNull();
    expect(await prisma.pet.count({ where: { userId: a.id, status: "ALIVE" } })).toBe(2);
    expect(await prisma.penalty.count({ where: { userId: a.id } })).toBe(1);
    const r2 = await prisma.$transaction((tx) => killRandomPet(tx, a.id, "thử", rules, at(TUE, "9:01"), first, TUE));
    expect(r2).not.toBeNull();
    expect(await prisma.pet.count({ where: { userId: a.id, status: "ALIVE" } })).toBe(1);
    expect(await prisma.penalty.count({ where: { userId: a.id } })).toBe(2);
  });

  it("Dần: lần quên đóng cửa đầu tháng không ai trộm được, lần sau thì được", async () => {
    const v = await staff("v@x.com", ["DAN"]);
    const t = await staff("t@x.com");
    await coins(v.id, 20);
    const s1 = await forgetful(v.id, MON);
    expect(await stealableYards(t.id, at(MON, "18:05"))).toHaveLength(0);
    await expect(steal(t.id, s1.id, at(MON, "18:05"))).rejects.toThrow(/Dần/);
    await forgetful(v.id, TUE);
    expect(await stealableYards(t.id, at(TUE, "18:05"))).toHaveLength(1);
  });

  it("Mùi: bị trộm chỉ mất 7%", async () => {
    const v = await staff("v@x.com", ["MUI"]);
    const t = await staff("t@x.com");
    await coins(v.id, 20);
    const s = await forgetful(v.id);
    expect((await steal(t.id, s.id, at(MON, "18:05"))).amount).toBe(147); // 7% của 21
  });

  it("Tỵ: người trộm mất thêm 1 xu, ví không bị âm", async () => {
    const v = await staff("v@x.com", ["TI"]);
    const t = await staff("t@x.com");
    await coins(v.id, 20);
    const s = await forgetful(v.id);
    const r = await steal(t.id, s.id, at(MON, "18:05"));
    expect(r.amount).toBe(210);
    expect(r.venom).toBe(100);
    expect(await coinBalance(t.id)).toBe(110);
  });
  it("Tỵ: đã trộm sân có Tỵ thì bị khoá 7 ngày không trộm được sân đó, người khác vẫn trộm được", async () => {
    const v = await staff("v@x.com", ["TI"]);
    const t = await staff("t@x.com");
    const o = await staff("o@x.com");
    await coins(v.id, 20);
    await coins(t.id, 5);
    const s1 = await forgetful(v.id, MON);
    await steal(t.id, s1.id, at(MON, "18:05"));
    const s2 = await forgetful(v.id, TUE);
    expect(await stealableYards(t.id, at(TUE, "18:05"))).toHaveLength(0);
    await expect(steal(t.id, s2.id, at(TUE, "18:05"))).rejects.toThrow(/Tỵ.*khoá trộm sân này tới 18h05 ngày 23\/11/);
    expect(await stealableYards(o.id, at(TUE, "18:05"))).toHaveLength(1);
    // Hết 7 ngày thì được trộm lại.
    await prisma.theft.updateMany({ where: { thiefId: t.id }, data: { createdAt: at("2026-11-09", "18:05") } });
    expect(await stealableYards(t.id, at(TUE, "18:05"))).toHaveLength(1);
  });
});

describe("kỹ năng trộm", () => {
  it("Tý: trần mỗi lần trộm 6 xu thay vì 5", async () => {
    const v = await staff("v@x.com");
    const ty = await staff("ty@x.com", ["TY"]);
    const plain = await staff("p@x.com");
    await coins(v.id, 199); // 200 xu sau khi cho ăn: 10% = 20 xu
    const s = await forgetful(v.id);
    expect((await steal(plain.id, s.id, at(MON, "18:05"))).amount).toBe(500);
    expect((await steal(ty.id, s.id, at(MON, "18:06"))).amount).toBe(600);
  });

  it("Thân: được làm người trộm thứ 4, 1 lần mỗi tuần", async () => {
    const v = await staff("v@x.com");
    const others = await Promise.all(["a", "b", "c"].map((n) => staff(`${n}@x.com`)));
    const than = await staff("than@x.com", ["THAN"]);
    await coins(v.id, 50);
    const s = await forgetful(v.id, MON);
    for (const o of others) await steal(o.id, s.id, at(MON, "18:05"));
    const list = await stealableYards(than.id, at(MON, "18:06"));
    expect(list).toHaveLength(1);
    expect(list[0].viaThan).toBe(true);
    await steal(than.id, s.id, at(MON, "18:06"));
    const s2 = await forgetful(v.id, TUE);
    for (const o of others) await steal(o.id, s2.id, at(TUE, "18:05"));
    await expect(steal(than.id, s2.id, at(TUE, "18:06"))).rejects.toThrow(/đủ số lần/);
  });

  it("Ngọ: 10 phút đầu chỉ người có Ngọ được trộm", async () => {
    const v = await staff("v@x.com");
    const ngo = await staff("ngo@x.com", ["NGO"]);
    const plain = await staff("p@x.com");
    await coins(v.id, 20);
    const s = await forgetful(v.id);
    expect(await stealableYards(plain.id, at(MON, "18:05"))).toHaveLength(0);
    await expect(steal(plain.id, s.id, at(MON, "18:05"))).rejects.toThrow(/Ngọ/);
    await steal(ngo.id, s.id, at(MON, "18:05"));
    await steal(plain.id, s.id, at(MON, "18:11"));
  });

  it("admin tắt kỹ năng thì không còn tác dụng", async () => {
    const rules = await getRules();
    await prisma.setting.upsert({
      where: { key: "rules" },
      create: { key: "rules", value: { ...rules, skills: { ...rules.skills, enabled: [] } } },
      update: { value: { ...rules, skills: { ...rules.skills, enabled: [] } } },
    });
    const a = await staff("a@x.com", ["THIN"]);
    expect((await feed(a.id, at(MON, "8:40"))).cents).toBe(100);
  });
});
