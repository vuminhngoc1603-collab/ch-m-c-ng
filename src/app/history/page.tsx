import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/session";
import { Nav } from "@/components/Nav";
import { fmtCoins, fmtVnd } from "@/lib/rules";
import { fmtDateTime, fmtDay } from "@/lib/time";
import { ZODIAC } from "@/lib/zodiac";

export const dynamic = "force-dynamic";

const COIN_TYPE = { FEED: "Cho ăn", STEAL_GAIN: "Trộm được", STEAL_LOSS: "Bị trộm", ADJUST: "Điều chỉnh", SKILL: "Kỹ năng con giáp" } as const;
const POINT_TYPE = { SETTLEMENT: "Quy đổi cuối tháng", EGG_PURCHASE: "Mua trứng", ADJUST: "Điều chỉnh", SKILL: "Kỹ năng con giáp" } as const;
const FEED = { PENDING: "Chưa tới", FED: "Đã cho ăn", MISSED: "Bỏ bữa", EXCUSED: "Miễn" } as const;
const CLOSE = { NONE: "—", PENDING: "Chưa đóng", CLOSED: "Đã đóng", FORGOT: "Quên đóng", SKIPPED: "—" } as const;

export default async function HistoryPage() {
  const user = await requireStaff();
  const [coins, points, att, settlements, penalties, pets] = await Promise.all([
    prisma.coinLedger.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.pointLedger.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.attendance.findMany({ where: { userId: user.id }, include: { shift: true }, orderBy: [{ day: "desc" }], take: 60 }),
    prisma.monthlySettlement.findMany({ where: { userId: user.id }, orderBy: { period: "desc" } }),
    prisma.penalty.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    prisma.pet.findMany({ where: { userId: user.id }, orderBy: { acquiredAt: "desc" } }),
  ]);
  return (
    <>
      <Nav user={user} />
      <main className="container grid">
        <h1>Lịch sử</h1>
        <section className="card">
          <h2>Chấm công gần đây</h2>
          <div className="table-wrap"><table>
            <thead><tr><th>Ngày</th><th>Lượt</th><th>Cho ăn</th><th>Giờ vào</th><th className="num">Xu</th><th>Đóng cửa</th><th>Giờ ra</th></tr></thead>
            <tbody>{att.map((a) => (
              <tr key={a.id}><td>{fmtDay(a.day)}</td><td>{a.shift.name}</td><td>{FEED[a.feedStatus]}</td><td>{fmtDateTime(a.feedAt)}</td>
                <td className="num">{a.coinsEarned ? fmtCoins(a.coinsEarned) : ""}</td><td>{CLOSE[a.closeStatus]}</td><td>{fmtDateTime(a.closeAt)}</td></tr>
            ))}</tbody>
          </table></div>
        </section>
        <div className="grid cols-2">
          <section className="card">
            <h2>Sổ xu</h2>
            <div className="table-wrap"><table>
              <tbody>{coins.map((c) => (
                <tr key={c.id}><td>{fmtDateTime(c.createdAt)}</td><td>{COIN_TYPE[c.type]}<div className="muted small">{c.reason}</div></td>
                  <td className="num" style={{ color: c.amount < 0 ? "var(--bad)" : "var(--good)" }}>{c.amount > 0 ? "+" : ""}{fmtCoins(c.amount)}</td></tr>
              ))}</tbody>
            </table></div>
          </section>
          <section className="card">
            <h2>Sổ điểm</h2>
            {points.length === 0 ? <p className="muted">Điểm được cộng khi chốt tháng.</p> : <table><tbody>{points.map((p) => (
              <tr key={p.id}><td>{fmtDateTime(p.createdAt)}</td><td>{POINT_TYPE[p.type]}<div className="muted small">{p.reason}</div></td>
                <td className="num">{p.amount > 0 ? "+" : ""}{p.amount}</td></tr>
            ))}</tbody></table>}
            <h2 style={{ marginTop: 16 }}>Quyết toán các tháng</h2>
            {settlements.length === 0 ? <p className="muted">Chưa có tháng nào được chốt.</p> : <table>
              <thead><tr><th>Tháng</th><th className="num">Biến động xu</th><th className="num">Điểm</th><th className="num">Phạt</th></tr></thead>
              <tbody>{settlements.map((s) => (
                <tr key={s.id}><td>{s.period}</td><td className="num">{fmtCoins(s.netCoins)}</td><td className="num">{s.points}</td><td className="num">{fmtVnd(s.penaltyVnd)}</td></tr>
              ))}</tbody></table>}
          </section>
        </div>
        <div className="grid cols-2">
          <section className="card">
            <h2>Con giáp đã nuôi</h2>
            <table><tbody>{pets.map((p) => (
              <tr key={p.id}><td>{ZODIAC[p.zodiac].emoji} {ZODIAC[p.zodiac].name}</td>
                <td>{p.source === "EGG" ? "Nở từ trứng" : p.source === "REGRANT" ? "Cấp lại" : "Cấp miễn phí"} · {fmtDateTime(p.acquiredAt)}</td>
                <td>{p.status === "DEAD" ? <span className="badge bad">Chết {fmtDateTime(p.diedAt)}</span> : <span className="badge good">Đang sống</span>}</td></tr>
            ))}</tbody></table>
          </section>
          <section className="card">
            <h2>Phạt (trừ lương)</h2>
            {penalties.length === 0 ? <p className="muted">Không có khoản phạt nào. 🎉</p> : <table><tbody>{penalties.map((p) => (
              <tr key={p.id}><td>{fmtDateTime(p.createdAt)}</td><td>{p.reason}</td><td className="num">{fmtVnd(p.amountVnd)}</td></tr>
            ))}</tbody></table>}
          </section>
        </div>
      </main>
    </>
  );
}
