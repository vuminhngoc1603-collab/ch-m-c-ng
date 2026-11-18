import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { Nav } from "@/components/Nav";
import { prisma } from "@/lib/db";
import { DAY_KIND, closeLabel, feedLabel, monthDays, monthRoster, timeOf, type DayKind, type RosterRow } from "@/server/roster";
import { fmtDay, prevPeriod, vn, WEEKDAY_VN, weekdayOf } from "@/lib/time";

export const dynamic = "force-dynamic";

function nextPeriod(p: string) {
  const [y, m] = p.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

function cellTitle(r: RosterRow, i: number) {
  const d = r.days[i];
  const parts = [`${fmtDay(d.day)}: ${DAY_KIND[d.kind].label}`];
  if (d.note) parts.push(d.note);
  for (const s of d.shifts) {
    const t = [s.name, feedLabel(s) + (s.feedAt ? ` ${timeOf(s.feedAt)}` : ""), closeLabel(s) + (s.closeAt ? ` ${timeOf(s.closeAt)}` : "")].filter(Boolean);
    parts.push(t.join(" · "));
  }
  return parts.join("\n");
}

const LEGEND: DayKind[] = ["WORK", "PARTIAL", "ABSENT", "LEAVE", "HOLIDAY", "NO_SHIFT", "PLANNED", "NO_DATA"];

export default async function RosterPage({ searchParams }: { searchParams: Promise<{ period?: string; user?: string }> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const current = vn(new Date()).period;
  const period = sp.period && /^\d{4}-\d{2}$/.test(sp.period) ? sp.period : current;
  const userId = sp.user || undefined;
  const [rows, staff, holidays] = await Promise.all([
    monthRoster(period, { userId }),
    prisma.user.findMany({ where: { role: { in: ["FULLTIME", "PARTTIME"] }, status: { not: "PENDING" } }, orderBy: [{ role: "asc" }, { name: "asc" }] }),
    prisma.holiday.findMany({ where: { day: { startsWith: period } } }),
  ]);
  const days = monthDays(period);
  const holidaySet = new Set(holidays.map((h) => h.day));
  const today = vn(new Date()).day;
  const q = (p: string, u = userId) => `?period=${p}${u ? `&user=${u}` : ""}`;
  const detail = userId ? rows[0] : undefined;

  return (
    <>
      <Nav user={admin} />
      <main className="container wide grid">
        <div className="row space">
          <h1>Ca làm & ngày nghỉ tháng {period}</h1>
          <form className="row" method="get">
            <input type="month" name="period" defaultValue={period} />
            <select name="user" defaultValue={userId ?? ""}>
              <option value="">Tất cả nhân viên</option>
              {staff.map((u) => (
                <option key={u.id} value={u.id}>{u.name ?? u.email} ({u.role === "FULLTIME" ? "FT" : "PT"})</option>
              ))}
            </select>
            <button className="btn">Xem</button>
            <a className="btn" href={`/api/roster${q(period)}`}>Tải CSV</a>
          </form>
        </div>
        <p className="muted small">
          <Link href={q(prevPeriod(period))}>← Tháng {prevPeriod(period)}</Link>
          {" · "}
          <Link href={q(nextPeriod(period))}>Tháng {nextPeriod(period)} →</Link>
          {detail && <> · <Link href={q(period, "")}>Xem cả công ty</Link></>}
        </p>

        <div className="roster-legend">
          {LEGEND.map((k) => (
            <span key={k}><i className={`rc ${DAY_KIND[k].tone}`}>{DAY_KIND[k].mark || " "}</i>{DAY_KIND[k].label}</span>
          ))}
        </div>

        {rows.length === 0 && <section className="card muted">Chưa có nhân viên nào được duyệt.</section>}

        {rows.length > 0 && (
          <section className="card table-wrap">
            <table className="roster">
              <thead>
                <tr>
                  <th className="sticky">Nhân viên</th>
                  {days.map((d) => (
                    <th key={d} className={`day${holidaySet.has(d) ? " hol" : ""}${weekdayOf(d) % 6 === 0 ? " wkd" : ""}${d === today ? " today" : ""}`}>
                      <div>{d.slice(8)}</div><div className="wd">{WEEKDAY_VN[weekdayOf(d)]}</div>
                    </th>
                  ))}
                  <th className="num" title="Ngày đi làm đủ">Đi làm</th>
                  <th className="num" title="Ngày thiếu bữa">Thiếu</th>
                  <th className="num" title="Ngày vắng">Vắng</th>
                  <th className="num" title="Nghỉ phép / lễ riêng đã duyệt">Phép</th>
                  <th className="num" title="Lượt quên đóng cửa">Quên đóng</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.userId}>
                    <td className="sticky">
                      <Link href={q(period, r.userId)}>{r.name}</Link>
                      <div className="muted small">{r.role === "FULLTIME" ? "Full-time" : "Part-time"}</div>
                    </td>
                    {r.days.map((d, i) => {
                      const k = DAY_KIND[d.kind];
                      const codes = r.role === "PARTTIME" && d.shifts.length > 0 ? d.shifts.map((s) => s.code).join(" ") : null;
                      return (
                        <td key={d.day} className="day" title={cellTitle(r, i)}>
                          <i className={`rc ${k.tone}`}>{k.mark}</i>
                          {codes && <div className="codes">{codes}</div>}
                        </td>
                      );
                    })}
                    <td className="num">{r.totals.workDays}</td>
                    <td className="num">{r.totals.partialDays}</td>
                    <td className="num">{r.totals.absentDays}</td>
                    <td className="num">{r.totals.leaveDays}</td>
                    <td className="num">{r.totals.forgotClose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
        {!detail && rows.length > 0 && <p className="muted small">Rê chuột vào một ô để xem ca và giờ cho ăn/đóng cửa, hoặc bấm tên để xem chi tiết từng ngày.</p>}

        {detail && (
          <section className="card table-wrap">
            <h2>Chi tiết từng ngày: {detail.name}</h2>
            <p className="muted small">
              {detail.totals.workDays} ngày đi làm đủ · {detail.totals.partialDays} ngày thiếu bữa · {detail.totals.absentDays} ngày vắng ·{" "}
              {detail.totals.leaveDays} ngày nghỉ phép · {detail.totals.holidayDays} ngày lễ · {detail.totals.fedShifts} lượt cho ăn ·{" "}
              {detail.totals.missedShifts} lượt bỏ bữa · {detail.totals.forgotClose} lượt quên đóng cửa
            </p>
            <table>
              <thead><tr><th>Ngày</th><th>Trạng thái</th><th>Ca / nhịp</th><th>Khung giờ</th><th>Cho ăn</th><th>Đóng cửa</th><th>Ghi chú</th></tr></thead>
              <tbody>
                {detail.days.flatMap((d) => {
                  const k = DAY_KIND[d.kind];
                  const head = (span: number) => (
                    <>
                      <td rowSpan={span}>{fmtDay(d.day)}</td>
                      <td rowSpan={span}><span className={`badge ${k.tone === "info" ? "" : k.tone === "off" || k.tone === "none" ? "" : k.tone}`}>{k.label}</span></td>
                    </>
                  );
                  if (d.shifts.length === 0) {
                    return [<tr key={d.day} className={k.tone === "off" ? "dim" : ""}>{head(1)}<td colSpan={4} className="muted">—</td><td className="small">{d.note}</td></tr>];
                  }
                  return d.shifts.map((s, j) => (
                    <tr key={`${d.day}-${s.code}`}>
                      {j === 0 && head(d.shifts.length)}
                      <td>{s.name}</td>
                      <td className="small muted">{s.window}</td>
                      <td>
                        <span className={`badge ${s.feedStatus === "FED" ? "good" : s.feedStatus === "MISSED" ? "bad" : ""}`}>{feedLabel(s)}</span>
                        {s.feedAt && <span className="small"> {timeOf(s.feedAt)}</span>}
                      </td>
                      <td>
                        {closeLabel(s) && <span className={`badge ${s.closeStatus === "CLOSED" ? "good" : s.closeStatus === "FORGOT" ? "bad" : ""}`}>{closeLabel(s)}</span>}
                        {s.closeAt && <span className="small"> {timeOf(s.closeAt)}</span>}
                      </td>
                      <td className="small">{[j === 0 ? d.note : null, s.adminNote ? `Admin đổi ca: ${s.adminNote}` : null].filter(Boolean).join(" · ")}</td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </>
  );
}
