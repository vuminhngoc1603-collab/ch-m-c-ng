import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function currentUser() {
  const s = await auth();
  if (!s?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: s.user.id } });
}

export async function requireUser() {
  const u = await currentUser();
  if (!u) redirect("/login");
  if (u.status !== "ACTIVE" || !u.role) redirect("/pending");
  return u;
}

/** Nhân viên nuôi con giáp (full-time / part-time). Admin chỉ quản trị. */
export async function requireStaff() {
  const u = await requireUser();
  if (u.role === "ADMIN") redirect("/admin");
  // Khoá cả đăng nhập theo Wi-Fi công ty (nếu admin chọn phạm vi "login").
  const { checkNetwork } = await import("@/server/network");
  const c = await checkNetwork(u, (await requestMeta()).ip);
  if (c.policy.scope === "login" && !c.allowed) redirect("/wifi");
  return u;
}

export async function requireAdmin() {
  const u = await requireUser();
  if (u.role !== "ADMIN") redirect("/");
  return u;
}

export async function requestMeta() {
  const h = await headers();
  return {
    // Vercel tự ghi đè 2 header này bằng IP thật của người dùng, client không giả được.
    ip: h.get("x-real-ip")?.trim() || (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null,
    ua: h.get("user-agent"),
  };
}
