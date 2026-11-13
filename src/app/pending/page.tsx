import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { logout } from "@/app/actions";

export default async function PendingPage() {
  const u = await currentUser();
  if (!u) redirect("/login");
  if (u.status === "ACTIVE" && u.role) redirect(u.role === "ADMIN" ? "/admin" : "/");
  return (
    <main className="login">
      <div className="card">
        <div style={{ fontSize: 48 }}>🥚</div>
        <h1>{u.status === "DISABLED" ? "Tài khoản đã bị khoá" : "Đang chờ admin duyệt"}</h1>
        <p className="muted">
          {u.status === "DISABLED"
            ? "Liên hệ admin nếu bạn nghĩ đây là nhầm lẫn."
            : <>Tài khoản <b>{u.email}</b> đã được tạo. Khi admin duyệt và gán vai trò, bạn sẽ nhận con giáp đầu tiên miễn phí.</>}
        </p>
        <form action={logout}><button className="btn" type="submit">Đăng xuất</button></form>
      </div>
    </main>
  );
}
