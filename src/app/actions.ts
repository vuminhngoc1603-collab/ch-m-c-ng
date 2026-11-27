"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { LeaveType, Role, UserStatus } from "@prisma/client";
import { AppError, prisma } from "@/lib/db";
import { signIn, signOut } from "@/auth";
import { currentUser, requestMeta, requireAdmin, requireStaff, requireUser } from "@/lib/session";
import { feed, closeYard } from "@/server/attendance";
import { steal } from "@/server/theft";
import { buyEgg, movePet } from "@/server/yard";
import { saveMyRegistrations, adminSetRegistrations } from "@/server/schedule";
import {
  approveUser, setUserStatus, setUserRole, adjustCoins, adjustPoints,
  requestLeave, reviewLeave, addHoliday, removeHoliday, restorePublicHoliday,
} from "@/server/admin";
import { runTick } from "@/server/tick";
import { syncPublicHolidays } from "@/server/holidays";
import { guardCheckIn, saveNetworkPolicy, type NetworkMode, type NetworkScope } from "@/server/network";
import { normalizeCidr } from "@/lib/ip";
import { logActivity } from "@/server/log";
import { settleMonth } from "@/server/settlement";
import { getRules, saveRules } from "@/server/settings";
import { mergeRules } from "@/lib/rules";
import { parseMin, vn } from "@/lib/time";
import { ZODIAC } from "@/lib/zodiac";
import { fmtCoins } from "@/lib/rules";

/** Chạy một thao tác, rồi quay lại `path` kèm thông báo thành công / lỗi. */
async function run(path: string, fn: () => Promise<string>) {
  let msg: string;
  try {
    msg = await fn();
  } catch (e) {
    const text = e instanceof AppError ? e.message : e instanceof Error && /Unique constraint/.test(e.message) ? "Thao tác bị trùng, vui lòng thử lại." : null;
    if (!text) throw e;
    redirect(`${path}${path.includes("?") ? "&" : "?"}err=${encodeURIComponent(text)}`);
  }
  revalidatePath(path.split("?")[0]);
  redirect(`${path}${path.includes("?") ? "&" : "?"}ok=${encodeURIComponent(msg)}`);
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

// ---------- Auth ----------

export async function loginGoogle() {
  await signIn("google", { redirectTo: "/" });
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}

// ---------- Đăng ký: chọn loại công việc (khi đang chờ duyệt) ----------

export async function chooseJobTypeAction(form: FormData) {
  const u = await currentUser();
  if (!u) redirect("/login");
  const role = String(form.get("jobType") ?? "");
  if (u.status !== "PENDING") redirect("/");
  if (role !== "FULLTIME" && role !== "PARTTIME") redirect("/pending?err=" + encodeURIComponent("Hãy chọn Full-time hoặc Part-time."));
  await prisma.user.update({ where: { id: u.id }, data: { requestedRole: role as Role } });
  revalidatePath("/pending");
  redirect("/pending?ok=" + encodeURIComponent("Đã lưu loại công việc. Admin sẽ duyệt theo lựa chọn này."));
}

// ---------- Nhân viên ----------

export async function feedAction() {
  const u = await requireStaff();
  const meta = await requestMeta();
  await run("/", async () => {
    await guardCheckIn(u, meta.ip, "feed");
    const r = await feed(u.id, new Date(), meta);
    return `Đã cho ăn ${r.slot.shift.name}: +${fmtCoins(r.cents)} xu.`;
  });
}

export async function closeAction() {
  const u = await requireStaff();
  const meta = await requestMeta();
  await run("/", async () => {
    await guardCheckIn(u, meta.ip, "close");
    await closeYard(u.id, new Date(), meta);
    return "Đã đóng cửa sân. Ví xu của bạn an toàn.";
  });
}

export async function stealAction(form: FormData) {
  const u = await requireStaff();
  const meta = await requestMeta();
  await run("/", async () => {
    const r = await steal(u.id, str(form, "attendanceId"), new Date(), meta.ip);
    return `Trộm được ${fmtCoins(r.amount)} xu!${r.notes.length ? " " + r.notes.join(", ") + "." : ""}`;
  });
}

export async function buyEggAction(form: FormData) {
  const u = await requireStaff();
  const slotRaw = str(form, "slot");
  await run("/", async () => {
    const r = await buyEgg(u.id, slotRaw === "" ? undefined : Number(slotRaw));
    const z = ZODIAC[r.pet.zodiac];
    return `Trứng nở ra ${z.emoji} ${z.name}! (−${r.price} điểm)`;
  });
}

export async function movePetAction(form: FormData) {
  const u = await requireStaff();
  await run("/", async () => {
    await movePet(u.id, str(form, "petId"), Number(str(form, "slot")));
    return "Đã đổi chỗ ở.";
  });
}

export async function registerShiftsAction(form: FormData) {
  const u = await requireStaff();
  const entries = form.getAll("reg").map((v) => {
    const [day, shiftId] = String(v).split("|");
    return { day, shiftId };
  });
  await run("/schedule", async () => {
    await saveMyRegistrations(u.id, entries);
    return `Đã lưu ${entries.length} ca cho tuần sau.`;
  });
}

export async function requestLeaveAction(form: FormData) {
  const u = await requireUser();
  await run("/schedule", async () => {
    const start = str(form, "startDay");
    await requestLeave(u.id, (str(form, "type") || "LEAVE") as LeaveType, start, str(form, "endDay") || start, str(form, "reason"));
    return "Đã gửi đơn nghỉ, chờ admin duyệt.";
  });
}

export async function cancelLeaveAction(form: FormData) {
  const u = await requireUser();
  await run("/schedule", async () => {
    const r = await prisma.leaveRequest.deleteMany({ where: { id: str(form, "id"), userId: u.id, status: "PENDING" } });
    if (!r.count) throw new AppError("Chỉ huỷ được đơn đang chờ duyệt.");
    return "Đã huỷ đơn nghỉ.";
  });
}

// ---------- Admin ----------

export async function approveUserAction(form: FormData) {
  const a = await requireAdmin();
  await run("/admin", async () => {
    await approveUser(a.id, str(form, "userId"), str(form, "role") as Role);
    return "Đã duyệt tài khoản.";
  });
}

export async function setRoleAction(form: FormData) {
  const a = await requireAdmin();
  await run("/admin", async () => {
    await setUserRole(a.id, str(form, "userId"), str(form, "role") as Role);
    return "Đã đổi vai trò.";
  });
}

export async function setStatusAction(form: FormData) {
  const a = await requireAdmin();
  await run("/admin", async () => {
    await setUserStatus(a.id, str(form, "userId"), str(form, "status") as UserStatus);
    return "Đã cập nhật trạng thái.";
  });
}

export async function reviewLeaveAction(form: FormData) {
  const a = await requireAdmin();
  await run("/admin", async () => {
    const ok = str(form, "decision") === "approve";
    await reviewLeave(a.id, str(form, "id"), ok);
    return ok ? "Đã duyệt nghỉ." : "Đã từ chối.";
  });
}

export async function adjustAction(form: FormData) {
  const a = await requireAdmin();
  const userId = str(form, "userId");
  await run(`/admin/user/${userId}`, async () => {
    const kind = str(form, "kind");
    const amount = Number(str(form, "amount").replace(",", "."));
    if (kind === "coins") await adjustCoins(a.id, userId, Math.round(amount * 100), str(form, "reason"));
    else await adjustPoints(a.id, userId, amount, str(form, "reason"));
    return "Đã ghi bút toán điều chỉnh.";
  });
}

export async function adminScheduleAction(form: FormData) {
  const a = await requireAdmin();
  const userId = str(form, "userId");
  const monday = str(form, "monday");
  const entries = form.getAll("reg").map((v) => {
    const [day, shiftId] = String(v).split("|");
    return { day, shiftId };
  });
  await run(`/admin/schedule?user=${userId}&week=${monday}`, async () => {
    await adminSetRegistrations(a.id, userId, monday, entries, str(form, "note"));
    return "Đã đổi ca hộ.";
  });
}

export async function addHolidayAction(form: FormData) {
  const a = await requireAdmin();
  await run("/admin/settings", async () => {
    await addHoliday(a.id, str(form, "day"), str(form, "name") || "Nghỉ lễ");
    return "Đã thêm ngày lễ.";
  });
}

export async function removeHolidayAction(form: FormData) {
  const a = await requireAdmin();
  await run("/admin/settings", async () => {
    await removeHoliday(a.id, str(form, "day"));
    return "Đã xoá ngày lễ.";
  });
}

export async function restoreHolidayAction(form: FormData) {
  const a = await requireAdmin();
  await run("/admin/settings", async () => {
    await restorePublicHoliday(a.id, str(form, "day"));
    return "Đã khôi phục ngày lễ.";
  });
}

export async function syncHolidaysAction() {
  await requireAdmin();
  await run("/admin/settings", async () => {
    const n = await syncPublicHolidays(new Date());
    return n ? `Đã nạp thêm ${n} ngày lễ theo lịch nhà nước.` : "Lịch lễ nhà nước đã đủ, không có ngày mới.";
  });
}

export async function saveShiftAction(form: FormData) {
  await requireAdmin();
  await run("/admin/settings", async () => {
    const close = str(form, "closeStart");
    await prisma.shift.update({
      where: { id: str(form, "id") },
      data: {
        name: str(form, "name"),
        feedStart: parseMin(str(form, "feedStart")),
        feedEnd: parseMin(str(form, "feedEnd")),
        closeStart: close ? parseMin(close) : null,
        closeEnd: close ? parseMin(str(form, "closeEnd")) : null,
        active: form.get("active") === "on",
      },
    }).catch((e) => { throw e instanceof Error && e.message.includes("Giờ") ? new AppError(e.message) : e; });
    return "Đã lưu ca.";
  });
}

export async function saveRulesAction(form: FormData) {
  await requireAdmin();
  await run("/admin/settings", async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(str(form, "rules"));
    } catch {
      throw new AppError("JSON không hợp lệ.");
    }
    await saveRules(mergeRules(parsed));
    return "Đã lưu cấu hình luật.";
  });
}

/** Admin bật/tắt khoá hệ số nhân (khoá = mỗi lần cho ăn luôn 1 xu). */
export async function setCoefLockAction(form: FormData) {
  const a = await requireAdmin();
  await run("/admin/settings", async () => {
    const locked = str(form, "locked") === "1";
    const rules = await getRules();
    await saveRules({ ...rules, coefLocked: locked });
    await logActivity(a.id, "admin.rules.coefLock", { locked });
    return locked ? "Đã khoá hệ số nhân: mỗi lần cho ăn = 1 xu." : "Đã mở hệ số nhân theo số con.";
  });
}

export async function runTickAction() {
  await requireAdmin();
  await run("/admin", async () => {
    await syncPublicHolidays(new Date());
    const s = await runTick(new Date());
    return `Đã quét: ${s.missed} bỏ bữa, ${s.deaths} con chết, ${s.forgot} quên đóng cửa, ${s.regranted} cấp lại.`;
  });
}

export async function settleAction(form: FormData) {
  await requireAdmin();
  const period = str(form, "period");
  await run(`/admin/report?period=${period}`, async () => {
    if (!/^\d{4}-\d{2}$/.test(period) || period >= vn(new Date()).period) throw new AppError("Chỉ chốt được tháng đã kết thúc.");
    const n = await settleMonth(period);
    return `Đã chốt tháng ${period} cho ${n} người.`;
  });
}

// ---------- Khoá Wi-Fi công ty ----------

export async function saveNetworkPolicyAction(form: FormData) {
  const a = await requireAdmin();
  await run("/admin/network", async () => {
    const mode = str(form, "mode") as NetworkMode;
    const scope = str(form, "scope") as NetworkScope;
    if (!["off", "warn", "enforce"].includes(mode) || !["actions", "login"].includes(scope)) throw new AppError("Lựa chọn không hợp lệ.");
    if (mode === "enforce" && (await prisma.allowedNetwork.count()) === 0) throw new AppError("Cần thêm ít nhất 1 Wi-Fi trước khi bật chặn.");
    await saveNetworkPolicy({ mode, scope });
    await logActivity(a.id, "admin.network.policy", { mode, scope });
    return mode === "off" ? "Đã tắt khoá Wi-Fi." : mode === "warn" ? "Đã bật chế độ chỉ cảnh báo." : "Đã bật chặn ngoài Wi-Fi công ty.";
  });
}

export async function addNetworkAction(form: FormData) {
  const a = await requireAdmin();
  const meta = await requestMeta();
  await run("/admin/network", async () => {
    const name = str(form, "name").trim();
    if (!name) throw new AppError("Đặt tên cho Wi-Fi (vd: Wi-Fi tầng 3).");
    const raw = form.get("useCurrent") ? meta.ip ?? "" : str(form, "cidr");
    const cidr = normalizeCidr(raw);
    if (!cidr) throw new AppError(form.get("useCurrent") ? "Không đọc được IP hiện tại của bạn." : "IP không hợp lệ. Ví dụ: 203.0.113.7 hoặc 203.0.113.0/28.");
    if (await prisma.allowedNetwork.findUnique({ where: { cidr } })) throw new AppError(`IP ${cidr} đã có trong danh sách.`);
    await prisma.allowedNetwork.create({ data: { name, cidr, createdById: a.id } });
    await logActivity(a.id, "admin.network.add", { name, cidr });
    return `Đã thêm ${name} (${cidr}).`;
  });
}

export async function removeNetworkAction(form: FormData) {
  const a = await requireAdmin();
  await run("/admin/network", async () => {
    const n = await prisma.allowedNetwork.delete({ where: { id: str(form, "id") } });
    await logActivity(a.id, "admin.network.remove", { name: n.name, cidr: n.cidr });
    return `Đã xoá ${n.name}.`;
  });
}

export async function setNetworkExemptAction(form: FormData) {
  const a = await requireAdmin();
  await run("/admin/network", async () => {
    const exempt = str(form, "exempt") === "1";
    const until = str(form, "until") || null;
    if (until && !/^\d{4}-\d{2}-\d{2}$/.test(until)) throw new AppError("Ngày hết hạn không hợp lệ.");
    if (until && until < vn(new Date()).day) throw new AppError("Ngày hết hạn đã qua.");
    const u = await prisma.user.update({
      where: { id: str(form, "userId") },
      data: { networkExempt: exempt, networkExemptUntil: exempt ? until : null },
    });
    await logActivity(a.id, "admin.network.exempt", { userId: u.id, exempt, until });
    return exempt
      ? `${u.name ?? u.email} được chấm công ngoài Wi-Fi công ty${until ? ` đến hết ngày ${until}` : " (không thời hạn)"}.`
      : `${u.name ?? u.email} phải chấm công ở Wi-Fi công ty.`;
  });
}
