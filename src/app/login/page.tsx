import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { loginGoogle } from "@/app/actions";
import { ALL_ZODIAC, ZODIAC } from "@/lib/zodiac";

const ERRORS: Record<string, string> = {
  domain: "Email của bạn không thuộc tên miền được phép.",
  disabled: "Tài khoản đã bị khoá. Liên hệ admin.",
  AccessDenied: "Đăng nhập bị từ chối.",
  Configuration: "Máy chủ chưa cấu hình đăng nhập Google.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const u = await currentUser();
  if (u) redirect(u.status === "ACTIVE" ? "/" : "/pending");
  const { error } = await searchParams;
  return (
    <main className="login">
      <div className="card">
        <h1>Sân 12 con giáp</h1>
        <p className="muted">Chấm công bằng cách cho con giáp ăn mỗi ngày.</p>
        <div className="zodiac-row">{ALL_ZODIAC.map((z) => ZODIAC[z].emoji).join("")}</div>
        {error && <div className="flash err">{ERRORS[error] ?? "Đăng nhập không thành công."}</div>}
        <form action={loginGoogle}>
          <button className="btn primary big" type="submit">Đăng nhập bằng Google</button>
        </form>
        <p className="muted small" style={{ marginTop: 16 }}>Lần đầu đăng nhập, tài khoản sẽ chờ admin duyệt.</p>
      </div>
    </main>
  );
}
