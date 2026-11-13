import { requireAdmin } from "@/lib/session";
import { Nav } from "@/components/Nav";
import { Flash } from "@/components/Flash";
import { computeMonth } from "@/server/settlement";
import { fmtCoins, fmtVnd } from "@/lib/rules";
import { prevPeriod, vn } from "@/lib/time";
import { settleAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ period?: string; ok?: string; err?: string }> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const current = vn(new Date()).period;
  const period = sp.period && /^\d{4}-\d{2}$/.test(sp.period) ? sp.period : current;
  const rows = await computeMonth(period);
  const allSettled = rows.length > 0 && rows.every((r) => r.settled);
  const total = (k: "netCoins" | "rewardVnd" | "penaltyVnd") => rows.reduce((s, r) => s + r[k], 0);
  return (
    <>
      <Nav user={admin} />
      <main className="container grid">
        <div className="row space">
          <h1>Biến động xu tháng {period}</h1>
          <form className="row" method="get">
            <input type="month" name="period" defaultValue={period} />
            <button className="btn">Xem</button>
            <a className="btn" href={`/api/report?period=${period}`}>Tải CSV</a>
          </form>
        </div>
        <Flash ok={sp.ok} err={sp.err} />
        <p className="muted">
          Biến động xu = xu cho ăn + xu trộm được − xu bị trộm (+ điều chỉnh). Dùng để tính thưởng (tham chiếu 1 xu = 2.000 đ) và quy đổi thành điểm (tháng âm tính 0 điểm).
          {period === current ? " Tháng hiện tại chưa kết thúc: số liệu đang chạy." : allSettled ? " Tháng đã chốt." : ""}
        </p>
        <section className="card table-wrap">
          <table>
            <thead><tr><th>Nhân viên</th><th className="num">Cho ăn</th><th className="num">Trộm được</th><th className="num">Bị trộm</th><th className="num">Điều chỉnh</th><th className="num">Biến động</th><th className="num">Thưởng tham chiếu</th><th className="num">Điểm</th><th className="num">Bỏ bữa</th><th className="num">Con chết</th><th className="num">Phạt</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.userId}>
                <td>{r.name}<div className="muted small">{r.role === "FULLTIME" ? "Full-time" : "Part-time"}{r.settled ? " · đã chốt" : ""}</div></td>
                <td className="num">{fmtCoins(r.feedCoins)}</td><td className="num">{fmtCoins(r.stealGainCoins)}</td><td className="num">{fmtCoins(r.stealLossCoins)}</td>
                <td className="num">{fmtCoins(r.adjustCoins)}</td><td className="num"><b>{fmtCoins(r.netCoins)}</b></td><td className="num">{fmtVnd(r.rewardVnd)}</td>
                <td className="num">{r.points}</td><td className="num">{r.missedCount}</td><td className="num">{r.deathCount}</td><td className="num">{fmtVnd(r.penaltyVnd)}</td>
              </tr>
            ))}</tbody>
            <tfoot><tr><th>Tổng</th><th colSpan={4}></th><th className="num">{fmtCoins(total("netCoins"))}</th><th className="num">{fmtVnd(total("rewardVnd"))}</th><th colSpan={3}></th><th className="num">{fmtVnd(total("penaltyVnd"))}</th></tr></tfoot>
          </table>
        </section>
        {period < current && !allSettled && (
          <form action={settleAction} className="row">
            <input type="hidden" name="period" value={period} />
            <button className="btn primary">Chốt tháng {period} & cộng điểm</button>
            <span className="muted small">Hệ thống tự chốt tháng trước vào ngày 1; nút này để chốt bù.</span>
          </form>
        )}
        <p className="muted small">Gợi ý: xem tháng trước <a href={`?period=${prevPeriod(current)}`}>{prevPeriod(current)}</a>.</p>
      </main>
    </>
  );
}
