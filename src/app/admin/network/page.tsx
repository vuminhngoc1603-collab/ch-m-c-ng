import { prisma } from "@/lib/db";
import { requireAdmin, requestMeta } from "@/lib/session";
import { Nav } from "@/components/Nav";
import { Flash } from "@/components/Flash";
import { checkNetwork, isExempt } from "@/server/network";
import { fmtDateTime, fmtDay } from "@/lib/time";
import { saveNetworkPolicyAction, addNetworkAction, removeNetworkAction, setNetworkExemptAction } from "@/app/actions";

export const dynamic = "force-dynamic";

const WHAT = { feed: "Cho ăn", close: "Đóng cửa" } as Record<string, string>;

export default async function NetworkPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const ip = (await requestMeta()).ip;
  const [check, nets, staff, events] = await Promise.all([
    checkNetwork({ role: "FULLTIME", networkExempt: false }, ip),
    prisma.allowedNetwork.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.user.findMany({ where: { status: "ACTIVE", role: { in: ["FULLTIME", "PARTTIME"] } }, orderBy: { name: "asc" } }),
    prisma.activityLog.findMany({ where: { action: { in: ["network.warn", "network.blocked"] } }, include: { user: true }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const { mode, scope } = check.policy;
  return (
    <>
      <Nav user={admin} />
      <main className="container grid">
        <h1>Khoá Wi-Fi công ty</h1>
        <Flash ok={sp.ok} err={sp.err} />

        <section className="card">
          <h2>Bạn đang ở mạng nào?</h2>
          <p>
            IP hiện tại của bạn: <b>{ip ?? "không xác định"}</b>{" "}
            {check.network ? <span className="badge good">Wi-Fi công ty: {check.network}</span> : <span className="badge bad">Chưa có trong danh sách</span>}
          </p>
          <p className="muted small">Trình duyệt không cho web đọc tên Wi-Fi. Mỗi Wi-Fi công ty đi ra Internet bằng 1 địa chỉ IP công cộng, hệ thống nhận ra Wi-Fi qua IP đó. Đường mạng cần IP tĩnh, nếu nhà mạng đổi IP thì phải thêm lại.</p>
          <form action={addNetworkAction} className="row">
            <input type="hidden" name="useCurrent" value="1" />
            <input name="name" placeholder="Tên Wi-Fi, vd Wi-Fi tầng 3" required style={{ minWidth: 220 }} />
            <button className="btn primary" disabled={!ip || !!check.network}>Thêm Wi-Fi đang kết nối</button>
          </form>
        </section>

        <section className="card">
          <h2>Wi-Fi được phép ({nets.length})</h2>
          {nets.length === 0 ? <p className="muted">Chưa có Wi-Fi nào. Đứng ở công ty, bắt Wi-Fi công ty rồi bấm "Thêm Wi-Fi đang kết nối".</p> : (
            <div className="table-wrap"><table>
              <thead><tr><th>Tên</th><th>IP / dải IP</th><th>Thêm lúc</th><th></th></tr></thead>
              <tbody>{nets.map((n) => (
                <tr key={n.id}>
                  <td>{n.name}</td><td><code>{n.cidr}</code></td><td className="muted small">{fmtDateTime(n.createdAt)}</td>
                  <td><form action={removeNetworkAction}><input type="hidden" name="id" value={n.id} /><button className="btn danger">Xoá</button></form></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
          <details style={{ marginTop: 12 }}>
            <summary className="muted small">Thêm bằng tay (khi biết IP tĩnh của đường mạng)</summary>
            <form action={addNetworkAction} className="row" style={{ marginTop: 8 }}>
              <input name="name" placeholder="Tên" required />
              <input name="cidr" placeholder="203.0.113.7 hoặc 203.0.113.0/28" required />
              <button className="btn">Thêm</button>
            </form>
          </details>
        </section>

        <section className="card">
          <h2>Chế độ</h2>
          <form action={saveNetworkPolicyAction} className="grid">
            <label className="field">Mức khoá
              <select name="mode" defaultValue={mode}>
                <option value="off">Tắt</option>
                <option value="warn">Chỉ cảnh báo (vẫn cho chấm công, ghi lại lượt ngoài Wi-Fi)</option>
                <option value="enforce">Chặn ngoài Wi-Fi công ty</option>
              </select>
            </label>
            <label className="field">Khoá cái gì
              <select name="scope" defaultValue={scope}>
                <option value="actions">Chỉ Cho ăn / Đóng cửa (vẫn xem sân, trộm xu ở nhà được)</option>
                <option value="login">Cả đăng nhập (ngoài Wi-Fi công ty không vào được web)</option>
              </select>
            </label>
            <div><button className="btn primary">Lưu</button></div>
          </form>
          <p className="muted small">Nên để "Chỉ cảnh báo" khoảng 1 tuần, xem danh sách bên dưới có ai ở công ty mà bị nhận nhầm không, rồi mới bật chặn. Tài khoản admin không bao giờ bị khoá.</p>
        </section>

        <section className="card">
          <h2>Được chấm công ngoài Wi-Fi công ty</h2>
          <p className="muted small">Chỉ người được admin cho phép mới chấm công được ngoài công ty. Để trống ngày = không thời hạn; có ngày thì hết ngày đó tự phải về Wi-Fi công ty.</p>
          <div className="table-wrap"><table><tbody>{staff.map((u) => (
            <tr key={u.id}>
              <td>{u.name ?? u.email}<div className="muted small">{u.email}</div></td>
              <td>
                {isExempt(u)
                  ? <span className="badge good">Được miễn{u.networkExemptUntil ? ` đến ${fmtDay(u.networkExemptUntil)}` : ""}</span>
                  : u.networkExempt ? <span className="badge bad">Hết hạn miễn {u.networkExemptUntil ? fmtDay(u.networkExemptUntil) : ""}</span>
                  : <span className="muted small">Phải ở Wi-Fi công ty</span>}
              </td>
              <td>
                {isExempt(u) ? (
                  <form action={setNetworkExemptAction}><input type="hidden" name="userId" value={u.id} /><input type="hidden" name="exempt" value="0" /><button className="btn">Bỏ miễn</button></form>
                ) : (
                  <form action={setNetworkExemptAction} className="row">
                    <input type="hidden" name="userId" value={u.id} /><input type="hidden" name="exempt" value="1" />
                    <label className="muted small">đến ngày <input type="date" name="until" /></label>
                    <button className="btn">Cho miễn</button>
                  </form>
                )}
              </td>
            </tr>
          ))}</tbody></table></div>
        </section>

        <section className="card">
          <h2>Lượt chấm công ngoài Wi-Fi công ty (50 gần nhất)</h2>
          {events.length === 0 ? <p className="muted">Chưa có lượt nào.</p> : (
            <div className="table-wrap"><table>
              <thead><tr><th>Lúc</th><th>Người</th><th>Thao tác</th><th>IP</th><th>Kết quả</th></tr></thead>
              <tbody>{events.map((e) => {
                const what = (e.meta as { what?: string } | null)?.what ?? "";
                return (
                  <tr key={e.id}>
                    <td className="muted small">{fmtDateTime(e.createdAt)}</td>
                    <td>{e.user?.name ?? e.user?.email ?? "?"}</td>
                    <td>{WHAT[what] ?? what}</td>
                    <td><code>{e.ip ?? "?"}</code></td>
                    <td>{e.action === "network.blocked" ? <span className="badge bad">Bị chặn</span> : <span className="badge">Cảnh báo</span>}</td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          )}
        </section>
      </main>
    </>
  );
}
