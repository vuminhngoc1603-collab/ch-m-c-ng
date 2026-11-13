import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { Nav } from "@/components/Nav";
import { Flash } from "@/components/Flash";
import { RegGrid } from "@/components/RegGrid";
import { registrationWindow, mondayOf, weekDays } from "@/server/schedule";
import { fmtDay, fmtMin, vn, addDays } from "@/lib/time";
import { registerShiftsAction, requestLeaveAction, cancelLeaveAction } from "@/app/actions";

export const dynamic = "force-dynamic";

const STATUS = { PENDING: ["Chờ duyệt", "warn"], APPROVED: ["Đã duyệt", "good"], REJECTED: ["Từ chối", "bad"] } as const;

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireStaff();
  const sp = await searchParams;
  const now = new Date();
  const v = vn(now);
  const win = await registrationWindow(now);
  const thisWeek = weekDays(mondayOf(v.day));
  const [ptShifts, ftShifts, regs, leaves, holidays] = await Promise.all([
    prisma.shift.findMany({ where: { kind: "PARTTIME", active: true }, orderBy: { feedStart: "asc" } }),
    prisma.shift.findMany({ where: { kind: "FULLTIME", active: true }, orderBy: { feedStart: "asc" } }),
    prisma.shiftRegistration.findMany({ where: { userId: user.id, day: { gte: thisWeek[0], lte: win.days[6] } }, include: { shift: true } }),
    prisma.leaveRequest.findMany({ where: { userId: user.id }, orderBy: { startDay: "desc" }, take: 20 }),
    prisma.holiday.findMany({ where: { day: { gte: v.day } }, orderBy: { day: "asc" }, take: 10 }),
  ]);
  const selNext = new Set(regs.filter((r) => win.days.includes(r.day)).map((r) => `${r.day}|${r.shiftId}`));
  const selThis = new Set(regs.filter((r) => thisWeek.includes(r.day)).map((r) => `${r.day}|${r.shiftId}`));
  const daysToFri = (5 - v.weekday + 7) % 7;

  return (
    <>
      <Nav user={user} />
      <main className="container grid">
        <h1>Lịch & nghỉ phép</h1>
        <Flash ok={sp.ok} err={sp.err} />

        {user.role === "PARTTIME" ? (
          <>
            <section className="card">
              <div className="row space">
                <h2>Đăng ký ca tuần sau ({fmtDay(win.days[0])} – {fmtDay(win.days[6])})</h2>
                <span className={`badge ${win.open ? "good" : ""}`}>{win.open ? "Đang mở (hết thứ Sáu thì khoá)" : `Đã khoá · mở lại thứ Sáu ${fmtDay(addDays(v.day, daysToFri || 7))}`}</span>
              </div>
              <form action={registerShiftsAction}>
                <RegGrid days={win.days} shifts={ptShifts} selected={selNext} disabled={!win.open} />
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="btn primary" disabled={!win.open}>Lưu đăng ký</button>
                  <span className="muted small">T7/CN không bắt buộc. Không chọn 2 ca chồng giờ. Sau thứ Sáu chỉ admin được đổi hộ.</span>
                </div>
              </form>
            </section>
            <section className="card">
              <h2>Tuần này</h2>
              <RegGrid days={thisWeek} shifts={ptShifts} selected={selThis} disabled />
            </section>
          </>
        ) : (
          <section className="card">
            <h2>Lịch full-time</h2>
            <p>Thứ 2 – thứ 6, không cần đăng ký. T7/CN không cần cho ăn.</p>
            <ul>
              {ftShifts.map((s) => (
                <li key={s.id}>
                  {s.name}: cho ăn {fmtMin(s.feedStart)}–{fmtMin(s.feedEnd)}
                  {s.closeStart != null && <>, đóng cửa {fmtMin(s.closeStart)}–{fmtMin(s.closeEnd!)}</>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="grid cols-2">
          <section className="card">
            <h2>Xin nghỉ phép / nghỉ lễ</h2>
            <form action={requestLeaveAction} className="grid" style={{ gap: 10 }}>
              <div className="row">
                <label className="field">Loại<select name="type"><option value="LEAVE">Nghỉ phép</option><option value="HOLIDAY">Nghỉ lễ</option></select></label>
                <label className="field">Từ ngày<input type="date" name="startDay" required /></label>
                <label className="field">Đến ngày<input type="date" name="endDay" /></label>
              </div>
              <label className="field">Lý do<input name="reason" placeholder="Tuỳ chọn" /></label>
              <div><button className="btn primary">Gửi đơn</button></div>
              <p className="muted small" style={{ margin: 0 }}>Ngày nghỉ được duyệt: không cho ăn, không tính xu, không tính bỏ bữa.</p>
            </form>
          </section>
          <section className="card">
            <h2>Đơn của tôi</h2>
            {leaves.length === 0 ? <p className="muted">Chưa có đơn nào.</p> : (
              <table>
                <tbody>
                  {leaves.map((l) => (
                    <tr key={l.id}>
                      <td>{l.type === "LEAVE" ? "Phép" : "Lễ"}</td>
                      <td>{l.startDay === l.endDay ? fmtDay(l.startDay) : `${fmtDay(l.startDay)} → ${fmtDay(l.endDay)}`}</td>
                      <td><span className={`badge ${STATUS[l.status][1]}`}>{STATUS[l.status][0]}</span></td>
                      <td>{l.status === "PENDING" && <form action={cancelLeaveAction}><input type="hidden" name="id" value={l.id} /><button className="btn danger">Huỷ</button></form>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {holidays.length > 0 && (
              <>
                <h2 style={{ marginTop: 16 }}>Lễ chung sắp tới</h2>
                <ul>{holidays.map((h) => <li key={h.day}>{fmtDay(h.day)}: {h.name}</li>)}</ul>
              </>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
