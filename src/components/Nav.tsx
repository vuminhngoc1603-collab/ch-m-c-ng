import Link from "next/link";
import type { User } from "@prisma/client";
import { logout } from "@/app/actions";
import { Help } from "./Help";

export function Nav({ user }: { user: User }) {
  const isAdmin = user.role === "ADMIN";
  return (
    <header className="topbar">
      <div className="inner">
        <Link href={isAdmin ? "/admin" : "/"} className="brand">🐲 Sân 12 con giáp</Link>
        <nav className="nav">
          {isAdmin ? (
            <>
              <Link href="/admin">Tài khoản & duyệt</Link>
              <Link href="/admin/schedule">Đổi ca hộ</Link>
              <Link href="/admin/roster">Ca & ngày nghỉ</Link>
              <Link href="/admin/report">Báo cáo tháng</Link>
              <Link href="/admin/network">Wi-Fi</Link>
              <Link href="/admin/settings">Cấu hình</Link>
            </>
          ) : (
            <>
              <Link href="/">Sân của tôi</Link>
              <Link href="/schedule">Lịch & nghỉ phép</Link>
              <Link href="/history">Lịch sử</Link>
            </>
          )}
        </nav>
        <form action={logout} className="row">
          <Help autoOpenKey={isAdmin ? undefined : "help-seen-v1"} />
          <span className="muted small">{user.name ?? user.email}</span>
          <button className="btn" type="submit">Đăng xuất</button>
        </form>
      </div>
    </header>
  );
}
