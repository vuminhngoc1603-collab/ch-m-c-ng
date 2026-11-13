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
    ip: (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || null,
    ua: h.get("user-agent"),
  };
}
