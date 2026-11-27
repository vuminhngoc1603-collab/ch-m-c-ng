import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { Nav } from "@/components/Nav";
import { Flash } from "@/components/Flash";
import { getRules } from "@/server/settings";
import { saveShiftAction, saveRulesAction, setCoefLockAction, addHolidayAction, removeHolidayAction, restoreHolidayAction, syncHolidaysAction } from "@/app/actions";
import { skippedPublicHolidays } from "@/server/holidays";
import { fmtDay, fmtMin, vn } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const today = vn(new Date()).day;
  const year = Number(today.slice(0, 4));
  const [shifts, rules, holidays, skipped] = await Promise.all([
    prisma.shift.findMany({ orderBy: [{ sortOrder: "asc" }] }),
    getRules(),
    // Năm nay + năm sau (lịch nhà nước tự nạp sẵn), cộng ngày admin thêm.
    prisma.holiday.findMany({ where: { day: { gte: `${year}-01-01`, lte: `${year + 1}-12-31` } }, orderBy: { day: "asc" } }),
    Promise.all([skippedPublicHolidays(year), skippedPublicHolidays(year + 1)]).then((l) => l.flat()),
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
            <p className="muted small">
              Lịch nghỉ lễ nhà nước (Tết Dương lịch, Tết Nguyên đán, Giỗ Tổ 10/3 âm lịch, 30/4, 1/5, Quốc khánh 2/9 + 1 ngày liền kề, Ngày Văn hoá 24/11,
              và nghỉ bù khi lễ trùng T7/CN) được <b>tự nạp sẵn</b> cho năm {year} và {year + 1}, không cần nhập. Ngày lễ không phải cho ăn, không tính bỏ bữa.
              Khi chính phủ công bố hoán đổi/nghỉ bù khác: thêm ngày mới ở dưới, xoá ngày không nghỉ (ngày lễ tự động đã xoá sẽ không bị nạp lại).
            </p>
            <form action={addHolidayAction} className="row">
              <input type="date" name="day" required />
              <input name="name" placeholder="Tên ngày lễ" />
              <button className="btn primary">Thêm / sửa tên</button>
            </form>
            <table style={{ marginTop: 10 }}><tbody>{holidays.map((h) => (
              <tr key={h.day} style={h.day < today ? { opacity: 0.55 } : undefined}><td>{fmtDay(h.day)}</td><td>{h.name}</td>
                <td><span className="muted small">{h.source === "AUTO" ? "Tự động" : "Admin"}</span></td>
                <td><form action={removeHolidayAction}><input type="hidden" name="day" value={h.day} /><button className="btn danger">Xoá</button></form></td></tr>
            ))}</tbody></table>
            {skipped.length > 0 && (
              <>
                <h3 style={{ marginTop: 12 }}>Ngày lễ nhà nước đã xoá</h3>
                <table><tbody>{skipped.map((h) => (
                  <tr key={h.day}><td>{fmtDay(h.day)}</td><td>{h.name}</td>
                    <td><form action={restoreHolidayAction}><input type="hidden" name="day" value={h.day} /><button className="btn">Khôi phục</button></form></td></tr>
                ))}</tbody></table>
              </>
            )}
            <form action={syncHolidaysAction} style={{ marginTop: 10 }}><button className="btn">Nạp lại lịch lễ nhà nước</button></form>
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
              coefLocked: true = khoá hệ số theo số con ở x1 (Thìn vẫn +thinBonus). coefTable: hệ số theo số con (1→12), chỉ dùng khi coefLocked = false. eggStep: giá trứng con thứ n = eggStep×(n−1). stealPercent/stealMaxCoins/stealMaxThieves: luật trộm.
              stealWindowStart/End: phút trong ngày (1050 = 17h30). deathStreak/deathMonthly: điều kiện chết (đếm lại từ 0 sau mỗi lần chết). penaltyVnd: phạt mỗi con chết.
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
