import type { User } from "@prisma/client";
import { prisma, AppError } from "@/lib/db";
import { ipInCidr } from "@/lib/ip";
import { logActivity } from "./log";
import { vn } from "@/lib/time";

/**
 * Khoá Wi-Fi công ty.
 * - mode "off": tắt.
 * - mode "warn": vẫn cho chấm công, chỉ ghi lại lượt bấm ngoài Wi-Fi công ty để admin xem.
 * - mode "enforce": chặn.
 * - scope "actions": chỉ khoá Cho ăn / Đóng cửa. scope "login": khoá luôn mọi trang của nhân viên.
 * Admin không bao giờ bị khoá (để không tự khoá mình ra ngoài).
 */
export type NetworkMode = "off" | "warn" | "enforce";
export type NetworkScope = "actions" | "login";
export type NetworkPolicy = { mode: NetworkMode; scope: NetworkScope };

const KEY = "networkLock";
const DEFAULT: NetworkPolicy = { mode: "off", scope: "actions" };

export async function getNetworkPolicy(): Promise<NetworkPolicy> {
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  const v = (row?.value ?? {}) as Partial<NetworkPolicy>;
  return {
    mode: v.mode === "warn" || v.mode === "enforce" ? v.mode : "off",
    scope: v.scope === "login" ? "login" : DEFAULT.scope,
  };
}

export async function saveNetworkPolicy(p: NetworkPolicy) {
  await prisma.setting.upsert({ where: { key: KEY }, create: { key: KEY, value: p }, update: { value: p } });
}

export type NetworkCheck = {
  policy: NetworkPolicy;
  ip: string | null;
  /** Tên Wi-Fi khớp, null nếu không khớp mạng nào. */
  network: string | null;
  exempt: boolean;
  /** true = được phép thao tác (khớp mạng, được miễn, hoặc khoá đang tắt / chỉ cảnh báo). */
  allowed: boolean;
};

type NetUser = Pick<User, "role" | "networkExempt"> & { networkExemptUntil?: string | null };

/** Người được admin cho chấm công ngoài công ty, còn trong thời hạn. */
export function isExempt(user: NetUser, now = new Date()) {
  if (user.role === "ADMIN") return true;
  if (!user.networkExempt) return false;
  return !user.networkExemptUntil || vn(now).day <= user.networkExemptUntil;
}

export async function checkNetwork(user: NetUser, ip: string | null): Promise<NetworkCheck> {
  const [policy, nets] = await Promise.all([getNetworkPolicy(), prisma.allowedNetwork.findMany()]);
  const hit = nets.find((n) => ipInCidr(ip, n.cidr));
  const exempt = isExempt(user);
  const onCompany = !!hit || exempt;
  return {
    policy,
    ip,
    network: hit?.name ?? null,
    exempt,
    allowed: policy.mode !== "enforce" || onCompany,
  };
}

/** Gọi trước khi Cho ăn / Đóng cửa. Chặn khi đang "enforce", ghi nhật ký khi "warn". */
export async function guardCheckIn(user: NetUser & { id: string }, ip: string | null, what: "feed" | "close") {
  const c = await checkNetwork(user, ip);
  if (c.policy.mode === "off" || c.network || c.exempt) return c;
  if (c.policy.mode === "warn") {
    await logActivity(user.id, "network.warn", { what }, ip);
    return c;
  }
  await logActivity(user.id, "network.blocked", { what }, ip);
  throw new AppError("Bạn đang không dùng Wi-Fi công ty nên không chấm công được. Hãy kết nối Wi-Fi công ty rồi thử lại.");
}
