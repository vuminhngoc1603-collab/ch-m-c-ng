import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";

const list = (v?: string) => (v ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [Google],
  session: { strategy: "database" },
  pages: { signIn: "/login", error: "/login" },
  trustHost: true,
  callbacks: {
    async signIn({ user, profile }) {
      const email = (user.email ?? "").toLowerCase();
      if (!email || profile?.email_verified === false) return false;
      const domains = list(process.env.ALLOWED_EMAIL_DOMAINS);
      if (domains.length && !domains.includes(email.split("@")[1])) return "/login?error=domain";
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing?.status === "DISABLED") return "/login?error=disabled";
      return true;
    },
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
  events: {
    // Tài khoản Google mới ở trạng thái chờ duyệt; email trong ADMIN_EMAILS tự thành admin.
    async createUser({ user }) {
      if (user.id && list(process.env.ADMIN_EMAILS).includes((user.email ?? "").toLowerCase())) {
        await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN", status: "ACTIVE", approvedAt: new Date() } });
      }
      await prisma.activityLog.create({ data: { userId: user.id, action: "auth.firstLogin" } });
    },
    async signIn({ user }) {
      if (user.id) await prisma.activityLog.create({ data: { userId: user.id, action: "auth.signIn" } }).catch(() => {});
    },
  },
});
