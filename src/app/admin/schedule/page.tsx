import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { Nav } from "@/components/Nav";
import { Flash } from "@/components/Flash";
import { RegGrid } from "@/components/RegGrid";
import { mondayOf, weekDays } from "@/server/schedule";
import { addDays, fmtDay, vn } from "@/lib/time";
import { adminScheduleAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function AdminSchedulePage({ searchParams }: { searchParams: Promise<{ user?: string; week?: string; ok?: string; err?: string }> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const today = vn(new Date()).day;
  const monday = mondayOf(sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : today);
  const days = weekDays(monday);
  const [pts, shifts] = await Promise.all([
    prisma.user.findMany({ where: { role: "PARTTIME", status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.shift.findMany({ where: { kind: "PARTTIME", active: true }, orderBy: { feedStart: "asc" } }),
  ]);
  const userId = sp.user ?? pts[0]?.id;
  const regs = userId ? await prisma.shiftRegistration.findMany({ where: { userId, day: { in: days } } }) : [];
  const all = await prisma.shiftRegistration.findMany({ where: { day: { in: days } }, include: { user: true, shift: true }, orderBy: [{ day: "asc" }] });

  return (
    <>
      <Nav user={admin} />
      <main className="container grid">
        <h1>Đổi ca hộ part-time</h1>
        <Flash ok={sp.ok} err={sp.err} />
        <form className="row card" method="get">
          <label className="field">Nhân viên
            <select name="user" defaultValue={userId}>{pts.map((p) => <option key={p.id} value={p.id}>{p.name ?? p.email}</option>)}</select>
          </label>
          <label className="field">Tuần chứa ngày<input type="date" name="week" defaultValue={monday} /></label>
          <button className="btn">Xem</button>
          <a className="btn" href={`?user=${userId ?? ""}&week=${addDays(monday, -7)}`}>← Tuần trước</a>
          <a className="btn" href={`?user=${userId ?? ""}&week=${addDays(monday, 7)}`}>Tuần sau →</a>
        </form>
        {userId ? (
          <section className="card">
            <h2>{fmtDay(days[0])} – {fmtDay(days[6])}</h2>
            <form action={adminScheduleAction}>
              <input type="hidden" name="userId" value={userId} />
              <input type="hidden" name="monday" value={monday} />
              <RegGrid days={days} shifts={shifts} selected={new Set(regs.map((r) => `${r.day}|${r.shiftId}`))} />
              <div className="row" style={{ marginTop: 12 }}>
                <input name="note" placeholder="Lý do đổi ca (bắt buộc)" required style={{ flex: 1, minWidth: 220 }} />
                <button className="btn primary">Lưu thay đổi</button>
              </div>
            </form>
          </section>
        ) : <p className="muted">Chưa có nhân viên part-time nào.</p>}
        <section className="card">
          <h2>Tất cả đăng ký trong tuần</h2>
          {all.length === 0 ? <p className="muted">Chưa có.</p> : <div className="table-wrap"><table><tbody>{all.map((r) => (
            <tr key={r.id}><td>{fmtDay(r.day)}</td><td>{r.shift.name}</td><td>{r.user.name ?? r.user.email}</td><td className="muted small">{r.note}</td></tr>
          ))}</tbody></table></div>}
        </section>
      </main>
    </>
  );
}
