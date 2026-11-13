import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { Nav } from "@/components/Nav";
import { Flash } from "@/components/Flash";
import { coinBalance, pointBalance } from "@/server/wallet";
import { fmtCoins, fmtVnd } from "@/lib/rules";
import { fmtDateTime, fmtDay } from "@/lib/time";
import { ZODIAC } from "@/lib/zodiac";
import { adjustAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function AdminUserPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u) notFound();
  const [coins, points, ledger, pets, att, penalties, logs] = await Promise.all([
    coinBalance(id), pointBalance(id),
    prisma.coinLedger.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.pet.findMany({ where: { userId: id }, orderBy: [{ status: "asc" }, { slot: "asc" }] }),
    prisma.attendance.findMany({ where: { userId: id }, include: { shift: true }, orderBy: { day: "desc" }, take: 40 }),
    prisma.penalty.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" } }),
    prisma.activityLog.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  return (
    <>
      <Nav user={admin} />
      <main className="container grid">
        <div><Link href="/admin">← Tài khoản</Link><h1>{u.name ?? u.email}</h1><div className="muted">{u.email} · {u.role} · bỏ bữa liên tiếp {u.missStreak}</div></div>
        <Flash ok={sp.ok} err={sp.err} />
        <div className="stats">
          <div className="stat"><div className="label">Ví xu</div><div className="value">{fmtCoins(coins)}</div></div>
          <div className="stat"><div className="label">Điểm</div><div className="value">{points}</div></div>
          <div className="stat"><div className="label">Con đang sống</div><div className="value">{pets.filter((p) => p.status === "ALIVE").length}</div></div>
          <div className="stat"><div className="label">Tổng phạt</div><div className="value">{fmtVnd(penalties.reduce((s, p) => s + p.amountVnd, 0))}</div></div>
        </div>
        <section className="card">
          <h2>Điều chỉnh (xử lý khiếu nại)</h2>
          <form action={adjustAction} className="row">
            <input type="hidden" name="userId" value={u.id} />
            <select name="kind"><option value="coins">Xu</option><option value="points">Điểm</option></select>
            <input name="amount" placeholder="vd 2 hoặc -1,5" required style={{ width: 130 }} />
            <input name="reason" placeholder="Lý do (bắt buộc)" required style={{ flex: 1, minWidth: 200 }} />
            <button className="btn primary">Ghi bút toán</button>
          </form>
          <p className="muted small">Không sửa/xoá bút toán cũ; mọi thay đổi là bút toán mới có lý do và người thực hiện.</p>
        </section>
        <div className="grid cols-2">
          <section className="card"><h2>Sổ xu</h2><div className="table-wrap"><table><tbody>{ledger.map((c) => (
            <tr key={c.id}><td>{fmtDateTime(c.createdAt)}</td><td>{c.type}<div className="muted small">{c.reason}</div></td><td className="num">{fmtCoins(c.amount)}</td></tr>
          ))}</tbody></table></div></section>
          <section className="card"><h2>Chấm công</h2><div className="table-wrap"><table><tbody>{att.map((a) => (
            <tr key={a.id}><td>{fmtDay(a.day)}</td><td>{a.shift.name}</td><td>{a.feedStatus}<div className="muted small">{fmtDateTime(a.feedAt)} {a.feedIp}</div></td><td>{a.closeStatus}<div className="muted small">{fmtDateTime(a.closeAt)}</div></td></tr>
          ))}</tbody></table></div></section>
        </div>
        <div className="grid cols-2">
          <section className="card"><h2>Sân</h2><table><tbody>{pets.map((p) => (
            <tr key={p.id}><td>{ZODIAC[p.zodiac].emoji} {ZODIAC[p.zodiac].name}</td><td>{p.source}</td><td>{p.status === "ALIVE" ? `Ô ${p.slot + 1}` : `Chết ${fmtDateTime(p.diedAt)}: ${p.deathReason}`}</td></tr>
          ))}</tbody></table></section>
          <section className="card"><h2>Nhật ký</h2><table><tbody>{logs.map((l) => (
            <tr key={l.id}><td>{fmtDateTime(l.createdAt)}</td><td>{l.action}</td><td className="muted small">{l.ip}</td></tr>
          ))}</tbody></table></section>
        </div>
      </main>
    </>
  );
}
