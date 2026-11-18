import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { feed, closeYard } from "@/server/attendance";
import { runTick } from "@/server/tick";
import { monthRoster, rosterCsv } from "@/server/roster";
import { getRules } from "@/server/settings";
import { at, first, makeUser, resetDb } from "./helpers";

const MON = "2026-11-16", TUE = "2026-11-17", WED = "2026-11-18", THU = "2026-11-19", FRI = "2026-11-20", SAT = "2026-11-21";

beforeEach(async () => {
  await resetDb();
  const rules = await getRules();
  await prisma.setting.upsert({
    where: { key: "rules" },
    create: { key: "rules", value: { ...rules, skills: { ...rules.skills, enabled: [] } } },
    update: { value: { ...rules, skills: { ...rules.skills, enabled: [] } } },
  });
});

const dayOf = (rows: Awaited<ReturnType<typeof monthRoster>>, userId: string, day: string) =>
  rows.find((r) => r.userId === userId)!.days.find((d) => d.day === day)!;

describe("báo cáo ca làm & ngày nghỉ", () => {
  it("full-time: đi làm, thiếu bữa, nghỉ phép, lễ, vắng, cuối tuần", async () => {
    const a = await makeUser("a@x.com", "FULLTIME", at(MON, "7:00"));
    await runTick(at(MON, "7:01"), first);
    await prisma.leaveRequest.create({ data: { userId: a.id, startDay: WED, endDay: WED, reason: "Việc nhà", status: "APPROVED" } });
    await prisma.holiday.create({ data: { day: THU, name: "Lễ thử" } });

    await feed(a.id, at(MON, "8:40"));
    await feed(a.id, at(MON, "13:50"));
    await closeYard(a.id, at(MON, "17:40"));
    await feed(a.id, at(TUE, "8:40")); // chiều T3 bỏ bữa
    await runTick(at(SAT, "9:00"), first);

    const rows = await monthRoster("2026-11", { now: at("2026-11-23", "9:00") });
    expect(rows).toHaveLength(1);
    const mon = dayOf(rows, a.id, MON);
    expect(mon.kind).toBe("WORK");
    expect(mon.shifts.map((s) => s.code)).toEqual(["FT_AM", "FT_PM"]);
    expect(mon.shifts[0].feedAt).toBeTruthy();
    expect(mon.shifts[1].closeStatus).toBe("CLOSED");
    expect(dayOf(rows, a.id, TUE).kind).toBe("PARTIAL");
    expect(dayOf(rows, a.id, WED)).toMatchObject({ kind: "LEAVE", note: "Việc nhà" });
    expect(dayOf(rows, a.id, THU)).toMatchObject({ kind: "HOLIDAY", note: "Lễ thử" });
    expect(dayOf(rows, a.id, FRI).kind).toBe("ABSENT");
    expect(dayOf(rows, a.id, SAT).kind).toBe("WEEKEND");
    expect(dayOf(rows, a.id, "2026-11-10").kind).toBe("NOT_STARTED");
    // Ngày tới đã có lịch nhịp full-time.
    expect(dayOf(rows, a.id, "2026-11-24")).toMatchObject({ kind: "PLANNED" });

    const t = rows[0].totals;
    expect(t).toMatchObject({ workDays: 1, partialDays: 1, absentDays: 1, leaveDays: 1, holidayDays: 1 });
    expect(t.fedShifts).toBe(3);
  });

  it("part-time: ca đã đăng ký, quên đóng cửa, ngày không có ca, admin đổi ca có ghi chú", async () => {
    const admin = await prisma.user.create({ data: { email: "ad@x.com", role: "ADMIN", status: "ACTIVE" } });
    const p = await makeUser("p@x.com", "PARTTIME", at(MON, "7:00"));
    const [p2, p5] = await Promise.all(["P2", "P5"].map((code) => prisma.shift.findUniqueOrThrow({ where: { code } })));
    await prisma.shiftRegistration.createMany({
      data: [
        { userId: p.id, day: MON, shiftId: p2.id, createdById: p.id },
        { userId: p.id, day: MON, shiftId: p5.id, createdById: admin.id, note: "Đổi ca cho bạn ốm" },
        { userId: p.id, day: "2026-11-25", shiftId: p2.id, createdById: p.id },
      ],
    });
    await runTick(at(MON, "7:01"), first);
    await feed(p.id, at(MON, "8:35"));
    await feed(p.id, at(MON, "19:05"));
    await closeYard(p.id, at(MON, "22:20"));
    await runTick(at(TUE, "9:00"), first); // P2 quên đóng cửa

    const rows = await monthRoster("2026-11", { now: at(WED, "9:00") });
    const mon = dayOf(rows, p.id, MON);
    expect(mon.kind).toBe("WORK");
    expect(mon.shifts.map((s) => [s.code, s.closeStatus])).toEqual([["P2", "FORGOT"], ["P5", "CLOSED"]]);
    expect(mon.shifts[1].adminNote).toBe("Đổi ca cho bạn ốm");
    expect(dayOf(rows, p.id, TUE).kind).toBe("NO_SHIFT");
    expect(dayOf(rows, p.id, "2026-11-25").kind).toBe("PLANNED");
    expect(rows[0].totals.forgotClose).toBe(1);

    const csv = rosterCsv(rows);
    expect(csv).toContain("Ca P5");
    expect(csv).toContain("Admin đổi ca: Đổi ca cho bạn ốm");
    // Lọc theo 1 người.
    expect(await monthRoster("2026-11", { userId: p.id })).toHaveLength(1);
  });

  it("đơn nghỉ chờ duyệt chỉ hiện ghi chú, không tính là nghỉ", async () => {
    const a = await makeUser("a@x.com", "FULLTIME", at(MON, "7:00"));
    await prisma.leaveRequest.create({ data: { userId: a.id, startDay: "2026-11-24", endDay: "2026-11-24", status: "PENDING" } });
    const rows = await monthRoster("2026-11", { now: at(MON, "9:00") });
    expect(dayOf(rows, a.id, "2026-11-24")).toMatchObject({ kind: "PLANNED", note: "Đơn nghỉ chờ duyệt" });
  });
});
