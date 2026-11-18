import type { CloseStatus, FeedStatus, LeaveType, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { addDays, fmtDateTime, fmtMin, periodBounds, vn, weekdayOf } from "@/lib/time";

/**
 * Báo cáo ca làm theo tháng: mỗi người, mỗi ngày đi làm hay nghỉ, làm ca/nhịp nào, cho ăn và đóng cửa lúc mấy giờ.
 * Chỉ đọc dữ liệu có sẵn (lượt chấm công, đăng ký ca, lịch lễ, đơn nghỉ), không thay đổi gì.
 */
export type DayKind =
  | "WORK" // đi làm đủ các lượt
  | "PARTIAL" // có lượt cho ăn, có lượt bỏ bữa
  | "ABSENT" // có lịch nhưng bỏ hết các bữa
  | "LEAVE" // nghỉ phép đã duyệt
  | "PERSONAL_HOLIDAY" // nghỉ lễ cá nhân đã duyệt
  | "HOLIDAY" // lễ chung
  | "WEEKEND" // T7/CN của full-time
  | "NO_SHIFT" // part-time không đăng ký ca ngày này
  | "TODAY" // hôm nay, chưa xong
  | "PLANNED" // ngày tới đã có lịch
  | "NOT_STARTED" // trước ngày được duyệt vào làm
  | "NO_DATA"; // ngày đã qua có lịch nhưng không có lượt chấm công

export const DAY_KIND: Record<DayKind, { label: string; mark: string; tone: "good" | "warn" | "bad" | "info" | "off" | "none" }> = {
  WORK: { label: "Đi làm", mark: "✓", tone: "good" },
  PARTIAL: { label: "Thiếu bữa", mark: "½", tone: "warn" },
  ABSENT: { label: "Vắng", mark: "✗", tone: "bad" },
  LEAVE: { label: "Nghỉ phép", mark: "P", tone: "info" },
  PERSONAL_HOLIDAY: { label: "Nghỉ lễ riêng", mark: "L", tone: "info" },
  HOLIDAY: { label: "Lễ chung", mark: "L", tone: "info" },
  WEEKEND: { label: "Cuối tuần", mark: "", tone: "off" },
  NO_SHIFT: { label: "Không có ca", mark: "·", tone: "off" },
  TODAY: { label: "Hôm nay", mark: "…", tone: "none" },
  PLANNED: { label: "Đã xếp lịch", mark: "○", tone: "none" },
  NOT_STARTED: { label: "Chưa vào làm", mark: "", tone: "off" },
  NO_DATA: { label: "Không có dữ liệu", mark: "?", tone: "warn" },
};

export type RosterShift = {
  code: string;
  name: string;
  /** Khung giờ của ca, vd "8h30–9h00 · đóng 17h30–18h00". */
  window: string;
  /** null = chưa tạo lượt (ngày tới, hoặc không có dữ liệu). */
  feedStatus: FeedStatus | null;
  feedAt: Date | null;
  closeStatus: CloseStatus | null;
  closeAt: Date | null;
  /** Admin đổi ca hộ (có ghi lý do). */
  adminNote: string | null;
};

export type RosterDay = {
  day: string;
  kind: DayKind;
  /** Tên lễ, lý do nghỉ, đơn nghỉ chờ duyệt... */
  note: string | null;
  shifts: RosterShift[];
};

export type RosterTotals = {
  workDays: number;
  partialDays: number;
  absentDays: number;
  leaveDays: number;
  holidayDays: number;
  fedShifts: number;
  missedShifts: number;
  forgotClose: number;
};

export type RosterRow = {
  userId: string;
  name: string;
  email: string;
  role: Role | null;
  days: RosterDay[];
  totals: RosterTotals;
};

function shiftWindow(s: { feedStart: number; feedEnd: number; closeStart: number | null; closeEnd: number | null }) {
  const feed = `${fmtMin(s.feedStart)}–${fmtMin(s.feedEnd)}`;
  return s.closeStart != null && s.closeEnd != null ? `${feed} · đóng ${fmtMin(s.closeStart)}–${fmtMin(s.closeEnd)}` : feed;
}

export function monthDays(period: string): string[] {
  const { first, last } = periodBounds(period);
  const out: string[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) out.push(d);
  return out;
}

export async function monthRoster(period: string, opts: { userId?: string; now?: Date } = {}): Promise<RosterRow[]> {
  const { first, last } = periodBounds(period);
  const today = vn(opts.now ?? new Date()).day;
  const days = monthDays(period);
  const [users, holidays, leaves, regs, atts, ftShifts] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ["FULLTIME", "PARTTIME"] }, status: { not: "PENDING" }, ...(opts.userId ? { id: opts.userId } : {}) },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
    prisma.holiday.findMany({ where: { day: { gte: first, lte: last } } }),
    prisma.leaveRequest.findMany({
      where: { status: { in: ["APPROVED", "PENDING"] }, startDay: { lte: last }, endDay: { gte: first }, ...(opts.userId ? { userId: opts.userId } : {}) },
    }),
    prisma.shiftRegistration.findMany({
      where: { day: { gte: first, lte: last }, ...(opts.userId ? { userId: opts.userId } : {}) },
      include: { shift: true },
    }),
    prisma.attendance.findMany({
      where: { day: { gte: first, lte: last }, ...(opts.userId ? { userId: opts.userId } : {}) },
      include: { shift: true },
    }),
    prisma.shift.findMany({ where: { kind: "FULLTIME", active: true }, orderBy: { feedStart: "asc" } }),
  ]);
  const holidayOf = new Map(holidays.map((h) => [h.day, h.name]));
  const key = (u: string, d: string) => `${u}|${d}`;
  const attBy = new Map<string, typeof atts>();
  for (const a of atts) attBy.set(key(a.userId, a.day), [...(attBy.get(key(a.userId, a.day)) ?? []), a]);
  const regBy = new Map<string, typeof regs>();
  for (const r of regs) regBy.set(key(r.userId, r.day), [...(regBy.get(key(r.userId, r.day)) ?? []), r]);

  return users.map((u) => {
    const approvedDay = u.approvedAt ? vn(u.approvedAt).day : null;
    const myLeaves = leaves.filter((l) => l.userId === u.id);
    const totals: RosterTotals = { workDays: 0, partialDays: 0, absentDays: 0, leaveDays: 0, holidayDays: 0, fedShifts: 0, missedShifts: 0, forgotClose: 0 };
    const out: RosterDay[] = days.map((day) => {
      const dayAtts = attBy.get(key(u.id, day)) ?? [];
      const dayRegs = regBy.get(key(u.id, day)) ?? [];
      const leave = (status: "APPROVED" | "PENDING") =>
        myLeaves.find((l) => l.status === status && l.startDay <= day && l.endDay >= day);
      const approved = leave("APPROVED");
      const pending = leave("PENDING");
      const holiday = holidayOf.get(day);
      const weekend = weekdayOf(day) === 0 || weekdayOf(day) === 6;

      // Danh sách ca: lượt chấm công đã có + ca đã đăng ký/nhịp full-time chưa tạo lượt.
      const byShift = new Map<string, RosterShift & { sort: number }>();
      for (const a of dayAtts) {
        byShift.set(a.shiftId, {
          code: a.shift.code, name: a.shift.name, window: shiftWindow(a.shift), sort: a.shift.feedStart,
          feedStatus: a.feedStatus, feedAt: a.feedAt, closeStatus: a.closeStatus, closeAt: a.closeAt,
          adminNote: dayRegs.find((r) => r.shiftId === a.shiftId && r.createdById !== u.id)?.note ?? null,
        });
      }
      const started = approvedDay != null && day >= approvedDay;
      const planned = u.role === "PARTTIME" ? dayRegs.map((r) => r.shift) : !weekend ? ftShifts : [];
      const off = !!holiday || !!approved;
      if (started && !off && u.status === "ACTIVE") {
        for (const s of planned) {
          if (byShift.has(s.id)) continue;
          byShift.set(s.id, {
            code: s.code, name: s.name, window: shiftWindow(s), sort: s.feedStart,
            feedStatus: null, feedAt: null, closeStatus: null, closeAt: null,
            adminNote: dayRegs.find((r) => r.shiftId === s.id && r.createdById !== u.id)?.note ?? null,
          });
        }
      }
      const shifts = [...byShift.values()].sort((a, b) => a.sort - b.sort).map(({ sort: _s, ...rest }) => rest);

      const fed = shifts.filter((s) => s.feedStatus === "FED").length;
      const missed = shifts.filter((s) => s.feedStatus === "MISSED").length;
      totals.fedShifts += fed;
      totals.missedShifts += missed;
      totals.forgotClose += shifts.filter((s) => s.closeStatus === "FORGOT").length;

      let kind: DayKind;
      let note: string | null = null;
      if (fed > 0 || missed > 0) {
        kind = missed === 0 ? "WORK" : fed === 0 ? "ABSENT" : "PARTIAL";
        if (day === today && shifts.some((s) => s.feedStatus === null || s.feedStatus === "PENDING")) kind = missed > 0 ? "PARTIAL" : "TODAY";
      } else if (!started) {
        kind = "NOT_STARTED";
      } else if (holiday) {
        kind = "HOLIDAY";
        note = holiday;
      } else if (approved) {
        kind = (approved.type as LeaveType) === "HOLIDAY" ? "PERSONAL_HOLIDAY" : "LEAVE";
        note = approved.reason;
      } else if (shifts.length === 0) {
        kind = u.role === "FULLTIME" && weekend ? "WEEKEND" : "NO_SHIFT";
      } else if (day > today) {
        kind = "PLANNED";
      } else if (day === today) {
        kind = "TODAY";
      } else {
        kind = "NO_DATA";
      }
      if (pending && !approved) note = [note, `Đơn nghỉ chờ duyệt${pending.reason ? `: ${pending.reason}` : ""}`].filter(Boolean).join(" · ");

      if (kind === "WORK") totals.workDays++;
      if (kind === "PARTIAL") totals.partialDays++;
      if (kind === "ABSENT") totals.absentDays++;
      if (kind === "LEAVE" || kind === "PERSONAL_HOLIDAY") totals.leaveDays++;
      if (kind === "HOLIDAY") totals.holidayDays++;
      return { day, kind, note, shifts };
    });
    return { userId: u.id, name: u.name ?? u.email, email: u.email, role: u.role, days: out, totals };
  });
}

const FEED_VN: Record<FeedStatus, string> = { PENDING: "Chưa tới giờ", FED: "Đã cho ăn", MISSED: "Bỏ bữa", EXCUSED: "Được miễn" };
const CLOSE_VN: Record<CloseStatus, string> = { NONE: "", PENDING: "Chưa đóng", CLOSED: "Đã đóng", FORGOT: "Quên đóng", SKIPPED: "Không cần" };

export function feedLabel(s: RosterShift) {
  return s.feedStatus ? FEED_VN[s.feedStatus] : "Chưa có lượt";
}
export function closeLabel(s: RosterShift) {
  return s.closeStatus ? CLOSE_VN[s.closeStatus] : "";
}

function hm(d: Date | null) {
  return d ? fmtDateTime(d).slice(6) : "";
}
export { hm as timeOf };

/** CSV: một dòng mỗi người/ngày/ca (ngày nghỉ là một dòng không có ca). */
export function rosterCsv(rows: RosterRow[]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ["Nhân viên", "Email", "Loại", "Ngày", "Trạng thái ngày", "Ca", "Khung giờ", "Cho ăn", "Giờ cho ăn", "Đóng cửa", "Giờ đóng cửa", "Ghi chú"];
  const lines = [head.join(",")];
  for (const r of rows) {
    const role = r.role === "FULLTIME" ? "Full-time" : "Part-time";
    for (const d of r.days) {
      const base = [r.name, r.email, role, d.day, DAY_KIND[d.kind].label];
      if (d.shifts.length === 0) lines.push([...base, "", "", "", "", "", "", d.note ?? ""].map(esc).join(","));
      for (const s of d.shifts) {
        const note = [d.note, s.adminNote ? `Admin đổi ca: ${s.adminNote}` : null].filter(Boolean).join(" · ");
        lines.push([...base, s.name, s.window, feedLabel(s), hm(s.feedAt), closeLabel(s), hm(s.closeAt), note].map(esc).join(","));
      }
    }
  }
  return "﻿" + lines.join("\n");
}
