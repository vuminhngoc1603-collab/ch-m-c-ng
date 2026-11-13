import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getRules } from "@/server/settings";
import { fmtMin } from "@/lib/time";
import { fmtVnd } from "@/lib/rules";
import { Help } from "./Help";
import { skillInfo } from "@/lib/skills";
import { ALL_ZODIAC, ZODIAC } from "@/lib/zodiac";
import { getNetworkPolicy } from "@/server/network";

const WEEKDAY = ["Chủ nhật", "thứ Hai", "thứ Ba", "thứ Tư", "thứ Năm", "thứ Sáu", "thứ Bảy"];

/** Khung quy tắc tóm tắt đặt cạnh khu vườn, theo đúng loại công việc của người xem. */
export async function RulesPanel({ role }: { role: Role }) {
  const [rules, shifts, net] = await Promise.all([
    getRules(),
    prisma.shift.findMany({ where: { active: true, kind: role === "PARTTIME" ? "PARTTIME" : "FULLTIME" }, orderBy: { sortOrder: "asc" } }),
    getNetworkPolicy(),
  ]);
  const span = (a: number, b: number) => `${fmtMin(a)}–${fmtMin(b)}`;
  const coef = rules.coefTable;

  return (
    <aside className="card rules-panel" aria-label="Quy tắc chơi">
      <div className="row space">
        <h2>📜 Quy tắc chơi</h2>
        <Help />
      </div>

      <details className="rules-acc" open>
        <summary>Nhiệm vụ mỗi ngày</summary>
        <ul>
          <li>Tới làm: bấm <b>🍚 Cho ăn</b> đúng khung giờ để nhận xu.</li>
          <li>Tan làm: bấm <b>🔒 Đóng cửa</b>, nếu không sẽ bị trộm xu.</li>
          {net.mode !== "off" && <li>Phải dùng <b>Wi-Fi công ty</b> khi bấm.</li>}
        </ul>
        {role === "PARTTIME" ? (
          <>
            <p className="small"><b>Giờ các ca</b> (chỉ tính ca bạn đã đăng ký):</p>
            <ul className="small">
              {shifts.map((s) => <li key={s.id}>{s.name}: ăn {span(s.feedStart, s.feedEnd)}{s.closeStart != null && s.closeEnd != null ? ` · đóng ${span(s.closeStart, s.closeEnd)}` : ""}</li>)}
            </ul>
            <p className="small rules-warn">Đăng ký ca tuần sau <b>chỉ trong {WEEKDAY[rules.registrationWeekday]}</b>, ở trang Lịch & nghỉ phép.</p>
          </>
        ) : (
          <>
            <p className="small"><b>Thứ Hai đến thứ Sáu:</b></p>
            <ul className="small">
              {shifts.map((s) => <li key={s.id}>{s.name}: ăn {span(s.feedStart, s.feedEnd)}{s.closeStart != null && s.closeEnd != null ? ` · đóng ${span(s.closeStart, s.closeEnd)}` : ""}</li>)}
            </ul>
          </>
        )}
      </details>

      <details className="rules-acc">
        <summary>Xu và hệ số</summary>
        <ul className="small">
          <li>1 lần cho ăn = 1 xu × hệ số. 1 xu = {fmtVnd(rules.coinVnd)}.</li>
          <li>Hệ số theo số con: 1 con x{coef[0]}, thêm mỗi con +{(coef[1] - coef[0]).toLocaleString("vi-VN")}, đủ {rules.maxPets} con x{coef[rules.maxPets - 1]}.</li>
        </ul>
      </details>

      <details className="rules-acc">
        <summary>Bỏ bữa, con giáp chết</summary>
        <ul className="small">
          <li>Bỏ {rules.deathStreak} bữa liên tiếp, hoặc từ bữa thứ {rules.deathMonthly} trong tháng: 1 con chết.</li>
          <li>Mỗi con chết phạt <b>{fmtVnd(rules.penaltyVnd)}</b> trừ lương.</li>
          <li>Mất con cuối thì hôm sau được cấp con mới.</li>
        </ul>
      </details>

      <details className="rules-acc">
        <summary>Trộm xu</summary>
        <ul className="small">
          <li>Quên đóng cửa: sân mở từ {fmtMin(rules.stealWindowStart)} đến hết ngày.</li>
          <li>Mỗi người trộm {rules.stealPercent}% ví, tối đa {rules.stealMaxCoins} xu; tối đa {rules.stealMaxThieves} người.</li>
          <li>Bạn cũng được trộm sân người khác trong khung giờ đó.</li>
        </ul>
      </details>

      <details className="rules-acc">
        <summary>Cuối tháng và mua trứng</summary>
        <ul className="small">
          <li>Biến động = xu cho ăn + trộm được − bị trộm + xu kỹ năng. Dùng để tính thưởng.</li>
          <li>Đổi 1 xu = {rules.pointsPerCoin} điểm (tháng âm = 0), điểm cộng dồn.</li>
          <li>Trứng con thứ n giá {rules.eggStep} × (n − 1) điểm, nở con ngẫu nhiên không trùng.</li>
        </ul>
      </details>

      <details className="rules-acc">
        <summary>Kỹ năng con giáp</summary>
        <p className="small">Chỉ có tác dụng khi con đó còn sống trong sân. Xem chi tiết ở mục ✨ Kỹ năng con giáp bên dưới.</p>
        <ul className="small">
          {ALL_ZODIAC.filter((z) => rules.skills.enabled.includes(z)).map((z) => <li key={z}>{ZODIAC[z].name}: {skillInfo(z, rules).name}</li>)}
        </ul>
      </details>

      <details className="rules-acc">
        <summary>Nghỉ phép, nghỉ lễ</summary>
        <ul className="small">
          <li>Gửi đơn trước ở trang Lịch & nghỉ phép. Được duyệt thì không bị tính bỏ bữa.</li>
        </ul>
      </details>

      <p className="muted small">Bấm <b>?</b> để xem hướng dẫn đầy đủ.</p>
    </aside>
  );
}
