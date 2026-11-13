import { redirect } from "next/navigation";
import { currentUser, requestMeta } from "@/lib/session";
import { checkNetwork } from "@/server/network";
import { logout } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function WifiBlockedPage() {
  const u = await currentUser();
  if (!u) redirect("/login");
  const ip = (await requestMeta()).ip;
  const c = await checkNetwork(u, ip);
  if (c.allowed || c.policy.scope !== "login") redirect("/");
  return (
    <main className="login">
      <div className="card">
        <div style={{ fontSize: 48 }}>📶</div>
        <h1>Hãy kết nối Wi-Fi công ty</h1>
        <p className="muted">Sân 12 con giáp chỉ mở khi bạn dùng Wi-Fi của công ty. Tắt 4G, kết nối Wi-Fi công ty rồi tải lại trang.</p>
        <p className="muted small">Mạng hiện tại: {ip ?? "không xác định"}. Nếu bạn đang ở công ty mà vẫn thấy trang này, báo admin.</p>
        <div className="row" style={{ justifyContent: "center", marginTop: 12 }}>
          <a className="btn primary" href="/">Tải lại</a>
          <form action={logout}><button className="btn" type="submit">Đăng xuất</button></form>
        </div>
      </div>
    </main>
  );
}
