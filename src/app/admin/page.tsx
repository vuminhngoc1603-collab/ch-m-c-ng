import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { Nav } from "@/components/Nav";
import { Flash } from "@/components/Flash";
import { maybeTick } from "@/server/tick";
import { fmtDateTime, fmtDay } from "@/lib/time";
import { approveUserAction, setRoleAction, setStatusAction, reviewLeaveAction, runTickAction } from "@/app/actions";

export const dynamic = "force-dynamic";

const ROLE = { ADMIN: "Admin", FULLTIME: "Full-time", PARTTIME: "Part-time" } as const;

function RoleSelect({ value }: { value?: string | null }) {
  return (
    <select name="role" defaultValue={value ?? "FULLTIME"}>
      <option value="FULLTIME">Full-time</option>
      <option value="PARTTIME">Part-time</option>
      <option value="ADMIN">Admin</option>
    </select>
  );
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  await maybeTick();
  const [pending, users, leaves, lastTick] = await Promise.all([
    prisma.user.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" } }),
    prisma.user.findMany({ where: { status: { not: "PENDING" } }, orderBy: [{ role: "asc" }, { name: "asc" }], include: { _count: { select: { pets: { where: { status: "ALIVE" } } } } } }),
    prisma.leaveRequest.findMany({ where: { status: "PENDING" }, include: { user: true }, orderBy: { startDay: "asc" } }),
    prisma.setting.findUnique({ where: { key: "lastTickAt" } }),
  ]);
  return (
    <>
      <Nav user={admin} />
      <main className="container grid">
        <div className="row space">
          <h1>Quản trị</h1>
          <form action={runTickAction} className="row">
            <span className="muted small">Quét lần cuối: {lastTick ? fmtDateTime(new Date(lastTick.value as string)) : "chưa"}</span>
            <button className="btn">Chạy quét ngay</button>
          </form>
        </div>
        <Flash ok={sp.ok} err={sp.err} />

        <section className="card">
          <h2>Chờ duyệt ({pending.length})</h2>
          {pending.length === 0 ? <p className="muted">Không có tài khoản nào chờ duyệt.</p> : (
            <div className="table-wrap"><table>
              <tbody>{pending.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}<div className="muted small">{u.email}</div></td>
                  <td className="muted small">Đăng nhập lần đầu {fmtDateTime(u.createdAt)}</td>
                  <td>
                    <form action={approveUserAction} className="row">
                      <input type="hidden" name="userId" value={u.id} />
                      <RoleSelect />
                      <button className="btn primary">Duyệt</button>
                    </form>
                  </td>
                  <td><form action={setStatusAction}><input type="hidden" name="userId" value={u.id} /><input type="hidden" name="status" value="DISABLED" /><button className="btn danger">Từ chối</button></form></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </section>

        <section className="card">
          <h2>Đơn nghỉ chờ duyệt ({leaves.length})</h2>
          {leaves.length === 0 ? <p className="muted">Không có đơn nào.</p> : (
            <div className="table-wrap"><table><tbody>{leaves.map((l) => (
              <tr key={l.id}>
                <td>{l.user.name ?? l.user.email}</td>
                <td>{l.type === "LEAVE" ? "Nghỉ phép" : "Nghỉ lễ"}</td>
                <td>{l.startDay === l.endDay ? fmtDay(l.startDay) : `${fmtDay(l.startDay)} → ${fmtDay(l.endDay)}`}</td>
                <td className="muted small">{l.reason}</td>
                <td>
                  <form action={reviewLeaveAction} className="row">
                    <input type="hidden" name="id" value={l.id} />
                    <button className="btn primary" name="decision" value="approve">Duyệt</button>
                    <button className="btn danger" name="decision" value="reject">Từ chối</button>
                  </form>
                </td>
              </tr>
            ))}</tbody></table></div>
          )}
        </section>

        <section className="card">
          <h2>Tài khoản ({users.length})</h2>
          <div className="table-wrap"><table>
            <thead><tr><th>Người dùng</th><th>Vai trò</th><th className="num">Con sống</th><th>Trạng thái</th><th></th></tr></thead>
            <tbody>{users.map((u) => (
              <tr key={u.id}>
                <td><Link href={`/admin/user/${u.id}`}>{u.name ?? u.email}</Link><div className="muted small">{u.email}</div></td>
                <td>
                  <form action={setRoleAction} className="row">
                    <input type="hidden" name="userId" value={u.id} />
                    <RoleSelect value={u.role} />
                    <button className="btn">Lưu</button>
                  </form>
                </td>
                <td className="num">{u.role === "ADMIN" ? "—" : u._count.pets}</td>
                <td>{u.status === "ACTIVE" ? <span className="badge good">Hoạt động</span> : <span className="badge bad">Đã khoá</span>}</td>
                <td>
                  {u.id !== admin.id && (
                    u.status === "ACTIVE"
                      ? <form action={setStatusAction}><input type="hidden" name="userId" value={u.id} /><input type="hidden" name="status" value="DISABLED" /><button className="btn danger">Khoá</button></form>
                      : <form action={approveUserAction}><input type="hidden" name="userId" value={u.id} /><input type="hidden" name="role" value={u.role ?? "FULLTIME"} /><button className="btn">Mở khoá</button></form>
                  )}
                </td>
              </tr>
            ))}</tbody>
          </table></div>
          <p className="muted small">Vai trò: {Object.values(ROLE).join(", ")}. Admin chỉ quản trị, không nuôi con giáp.</p>
        </section>
      </main>
    </>
  );
}
