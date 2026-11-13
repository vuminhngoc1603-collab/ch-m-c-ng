import { describe, expect, it, beforeEach } from "vitest";
import { ipInCidr, normalizeCidr } from "@/lib/ip";
import { prisma } from "@/lib/db";
import { guardCheckIn, saveNetworkPolicy, checkNetwork } from "@/server/network";

describe("so khớp IP", () => {
  it("IPv4 đơn và dải", () => {
    expect(ipInCidr("203.0.113.7", "203.0.113.7")).toBe(true);
    expect(ipInCidr("203.0.113.8", "203.0.113.7")).toBe(false);
    expect(ipInCidr("203.0.113.9", "203.0.113.0/28")).toBe(true);
    expect(ipInCidr("203.0.113.17", "203.0.113.0/28")).toBe(false);
    expect(ipInCidr("::ffff:203.0.113.7", "203.0.113.7")).toBe(true);
  });
  it("IPv6", () => {
    expect(ipInCidr("2001:db8::1", "2001:db8::/32")).toBe(true);
    expect(ipInCidr("2001:db9::1", "2001:db8::/32")).toBe(false);
    expect(ipInCidr("2001:db8:0:0:0:0:0:1", "2001:db8::1")).toBe(true);
  });
  it("chặn dữ liệu sai và dải quá rộng", () => {
    expect(normalizeCidr("1.2.3.4")).toBe("1.2.3.4");
    expect(normalizeCidr("1.2.3.0/24")).toBe("1.2.3.0/24");
    expect(normalizeCidr("0.0.0.0/0")).toBeNull();
    expect(normalizeCidr("999.1.1.1")).toBeNull();
    expect(normalizeCidr("abc")).toBeNull();
    expect(ipInCidr(null, "1.2.3.4")).toBe(false);
  });
});

describe("khoá Wi-Fi công ty", () => {
  const staff = { id: "", role: "FULLTIME" as const, networkExempt: false };
  beforeEach(async () => {
    await prisma.allowedNetwork.deleteMany();
    await prisma.allowedNetwork.create({ data: { name: "Wi-Fi tầng 3", cidr: "203.0.113.0/28" } });
    const u = await prisma.user.upsert({ where: { email: "wifi@test.vn" }, create: { email: "wifi@test.vn", role: "FULLTIME", status: "ACTIVE" }, update: {} });
    staff.id = u.id;
  });

  it("tắt: không chặn gì", async () => {
    await saveNetworkPolicy({ mode: "off", scope: "actions" });
    await expect(guardCheckIn(staff, "8.8.8.8", "feed")).resolves.toBeTruthy();
  });
  it("cảnh báo: cho qua nhưng ghi nhật ký", async () => {
    await saveNetworkPolicy({ mode: "warn", scope: "actions" });
    await guardCheckIn(staff, "8.8.8.8", "feed");
    expect(await prisma.activityLog.count({ where: { userId: staff.id, action: "network.warn" } })).toBeGreaterThan(0);
  });
  it("chặn: ngoài Wi-Fi bị từ chối, trong Wi-Fi và người được miễn thì qua", async () => {
    await saveNetworkPolicy({ mode: "enforce", scope: "actions" });
    await expect(guardCheckIn(staff, "8.8.8.8", "feed")).rejects.toThrow(/Wi-Fi công ty/);
    await expect(guardCheckIn(staff, "203.0.113.5", "feed")).resolves.toMatchObject({ network: "Wi-Fi tầng 3" });
    await expect(guardCheckIn({ ...staff, networkExempt: true }, "8.8.8.8", "close")).resolves.toBeTruthy();
    expect((await checkNetwork({ role: "ADMIN", networkExempt: false }, "8.8.8.8")).allowed).toBe(true);
    await saveNetworkPolicy({ mode: "off", scope: "actions" });
  });
});

describe("miễn chấm công ngoài công ty có thời hạn", () => {
  it("hết ngày hết hạn thì phải về Wi-Fi công ty", async () => {
    const { isExempt } = await import("@/server/network");
    const { at } = await import("./helpers");
    const u = { role: "FULLTIME" as const, networkExempt: true, networkExemptUntil: "2026-11-20" };
    expect(isExempt(u, at("2026-11-20", "23:00"))).toBe(true);
    expect(isExempt(u, at("2026-11-21", "8:00"))).toBe(false);
    expect(isExempt({ ...u, networkExemptUntil: null }, at("2030-01-01", "8:00"))).toBe(true);
    expect(isExempt({ ...u, networkExempt: false }, at("2026-11-20", "8:00"))).toBe(false);
  });
});
