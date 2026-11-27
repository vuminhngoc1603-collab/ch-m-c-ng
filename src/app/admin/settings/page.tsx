import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { Nav } from "@/components/Nav";
import { Flash } from "@/components/Flash";
import { getRules } from "@/server/settings";
import { fmtDay, fmtMin } from "@/lib/time";
import { saveShiftAction, saveRulesAction, setCoefLockAction, addHolidayAction, removeHolidayAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const [shifts, rules, holidays] = await Promise.all([
    prisma.shift.findMany({ orderBy: [{ sortOrder: "asc" }] }),
    getRules(),
    prisma.holiday.findMany({ orderBy: { day: "desc" }, take: 30 }),
  ]);
  return (
    <>
      <Nav user={admin} />
      <main className="container grid">
        <h1>Cấu hình</h1>
        <Flash ok={sp.ok} err={sp.err} />
        <section className="card">
          <h2>Danh mục ca</h2>
          <div className="table-wrap"><table>
            <thead><tr><th>Mã</th><th>Tên</th><th>Cho ăn từ</th><th>đến</th><th>Đóng cửa từ</th><th>đến</th><th>Bật</th><th></th></tr></thead>
            <tbody>{shifts.map((s) => (
              <tr key={s.id}>
                <td>{s.code}<div className="muted small">{s.kind === "FULLTIME" ? "Full-time" : "Part-time"}</div></td>
                <td colSpan={7}>
                  <form action={saveShiftAction} className="row">
                    <input type="hidden" name="id" value={s.id} />
                    <input name="name" defaultValue={s.name} style={{ width: 110 }} />
                    <input name="feedStart" defaultValue={fmtMin(s.feedStart)} style={{ width: 70 }} />
                    <input name="feedEnd" defaultValue={fmtMin(s.feedEnd)} style={{ width: 70 }} />
                    <input name="closeStart" defaultValue={s.closeStart != null ? fmtMin(s.closeStart) : ""} placeholder="không" style={{ width: 70 }} />
                    <input name="closeEnd" defaultValue={s.closeEnd != null ? fmtMin(s.closeEnd) : ""} style={{ width: 70 }} />
                    <input type="checkbox" name="active" defaultChecked={s.active} />
                    <button className="btn">Lưu</button>
                  </form>
                </td>
              </tr>
            ))}</tbody>
          </table></div>
          <p className="muted small">Giờ dạng 8h30 hoặc 8:30. Để trống "Đóng cửa từ" nếu lượt không cần check out.</p>
        </section>
        <div className="grid cols-2">
          <section className="card">
            <h2>Ngày nghỉ lễ chung</h2>
            <form action={addHolidayAction} className="row">
              <input type="date" name="day" required />
              <input name="name" placeholder="Tên ngày lễ" />
              <button className="btn primary">Thêm</button>
            </form>
            <table style={{ marginTop: 10 }}><tbody>{holidays.map((h) => (
              <tr key={h.day}><td>{fmtDay(h.day)}</td><td>{h.name}</td>
                <td><form action={removeHolidayAction}><input type="hidden" name="day" value={h.day} /><button className="btn danger">Xoá</button></form></td></tr>
            ))}</tbody></table>
          </section>
          <section className="card">
            <h2>Luật (Rules Engine)</h2>
            <form action={setCoefLockAction} className="row" style={{ marginBottom: 10 }}>
              <input type="hidden" name="locked" value={rules.coefLocked ? "0" : "1"} />
              <span>
                Hệ số nhân: <b>{rules.coefLocked ? "đang khoá (mỗi lần cho ăn = 1 xu)" : `đang mở (1 con x${rules.coefTable[0]} … ${rules.maxPets} con x${rules.coefTable[rules.maxPets - 1]})`}</b>
              </span>
              <button className={`btn ${rules.coefLocked ? "primary" : "danger"}`}>{rules.coefLocked ? "Mở hệ số" : "Khoá hệ số"}</button>
            </form>
            <form action={saveRulesAction} className="grid" style={{ gap: 10 }}>
              <textarea name="rules" rows={18} defaultValue={JSON.stringify(rules, null, 2)} />
              <div><button className="btn primary">Lưu cấu hình</button></div>
            </form>
            <p className="muted small">
              coefLocked: true = khoá hệ số, mỗi lần cho ăn luôn 1 xu. coefTable: hệ số theo số con (1→12), chỉ dùng khi coefLocked = false. eggStep: giá trứng con thứ n = eggStep×(n−1). stealPercent/stealMaxCoins/stealMaxThieves: luật trộm.
              stealWindowStart/End: phút trong ngày (1050 = 17h30). deathStreak/deathMonthly: điều kiện chết (đếm lại từ 0 sau mỗi lần chết). penaltyVnd: phạt mỗi con chết.
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
