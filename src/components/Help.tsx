import { prisma } from "@/lib/db";
import { getRules } from "@/server/settings";
import { fmtMin } from "@/lib/time";
import { fmtVnd } from "@/lib/rules";
import { HelpButton } from "./HelpButton";
import { getNetworkPolicy } from "@/server/network";

const WEEKDAY = ["Chủ nhật", "thứ Hai", "thứ Ba", "thứ Tư", "thứ Năm", "thứ Sáu", "thứ Bảy"];

/** Bảng hướng dẫn: số liệu lấy từ cấu hình hiện tại, admin đổi luật thì hướng dẫn tự đổi theo. */
export async function Help({ autoOpenKey }: { autoOpenKey?: string }) {
  const [rules, shifts, net] = await Promise.all([
    getRules(),
    prisma.shift.findMany({ where: { active: true }, orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] }),
    getNetworkPolicy(),
  ]);
  const ft = shifts.filter((s) => s.kind === "FULLTIME");
  const pt = shifts.filter((s) => s.kind === "PARTTIME");
  const span = (a: number, b: number) => `${fmtMin(a)}–${fmtMin(b)}`;
  const ftClose = ft.find((s) => s.closeStart != null);
  const coef = rules.coefTable;
  const egg = (n: number) => rules.eggStep * (n - 1);

  return (
    <HelpButton autoOpenKey={autoOpenKey}>
      <p className="lead">Mỗi người có một <b>sân</b> nuôi con giáp. Đi làm đúng giờ = <b>cho con giáp ăn</b> để nhận xu. Tan làm = <b>đóng cửa sân</b>. Cuối tháng xu được tính thưởng và đổi thành điểm để mua trứng nở con mới.</p>

      <h3>1. Bắt đầu</h3>
      <ol>
        <li>Đăng nhập bằng Gmail, chọn <b>loại công việc</b> (Full-time hoặc Part-time).</li>
        <li>Chờ admin duyệt. Được duyệt xong bạn nhận <b>1 con giáp ngẫu nhiên miễn phí</b>.</li>
        <li>Mỗi ngày vào trang <b>Sân của tôi</b>, bấm <b>🍚 Cho ăn</b> khi tới làm và <b>🔒 Đóng cửa</b> khi tan làm, đúng khung giờ.</li>
      </ol>

      <h3>2. Khung giờ</h3>
      <p><b>Full-time</b> (thứ Hai đến thứ Sáu, thứ Bảy và Chủ nhật nghỉ):</p>
      <ul>
        {ft.map((s) => <li key={s.id}>{s.name}: cho ăn {span(s.feedStart, s.feedEnd)}{s.closeStart != null && s.closeEnd != null ? `, đóng cửa ${span(s.closeStart, s.closeEnd)}` : ""}</li>)}
      </ul>
      <p><b>Part-time</b>: chỉ phải cho ăn và đóng cửa ở những ca đã đăng ký.</p>
      <ul>
        {pt.map((s) => <li key={s.id}>{s.name}: cho ăn {span(s.feedStart, s.feedEnd)}{s.closeStart != null && s.closeEnd != null ? `, đóng cửa ${span(s.closeStart, s.closeEnd)}` : ""}</li>)}
      </ul>
      <div className="help-note">
        <b>Part-time đăng ký ca tuần sau chỉ trong ngày {WEEKDAY[rules.registrationWeekday]}</b>, ở trang <b>Lịch & nghỉ phép</b>. Hết ngày đó lịch bị khoá, muốn đổi phải nhờ admin. Không chọn được 2 ca trùng giờ.
      </div>
      <p className="muted small">Giờ tính theo giờ Việt Nam, lấy theo đồng hồ máy chủ. Bấm sớm hay muộn hơn khung giờ đều không được tính.</p>

      <h3>3. Xu</h3>
      <ul>
        <li>Mỗi lần cho ăn đúng giờ được <b>1 xu × hệ số</b>. 1 xu = {fmtVnd(rules.coinVnd)}.</li>
        <li>Hệ số tăng theo số con đang sống: 1 con x{coef[0]}, 2 con x{coef[1]}, 3 con x{coef[2]}… {rules.maxPets} con x{coef[rules.maxPets - 1]}.</li>
        <li>Nuôi càng nhiều con, mỗi bữa càng được nhiều xu.</li>
      </ul>

      <h3>4. Bỏ bữa và con giáp chết</h3>
      <ul>
        <li>Không bấm cho ăn trong khung giờ là <b>bỏ bữa</b>.</li>
        <li>Bỏ <b>{rules.deathStreak} bữa liên tiếp</b>, hoặc bỏ tới bữa thứ <b>{rules.deathMonthly}</b> trong tháng (và mỗi bữa bỏ sau đó), thì <b>1 con ngẫu nhiên chết</b>.</li>
        <li>Mỗi con chết bị <b>phạt {fmtVnd(rules.penaltyVnd)} trừ vào lương</b> (không trừ xu).</li>
        <li>Nếu chết mất con cuối cùng, hôm sau bạn được cấp 1 con mới.</li>
      </ul>
      <div className="help-note">Con giáp đói sẽ đi chậm và nhạt màu, sắp chết thì chuyển xám. Nhìn sân là biết cần chăm con nào.</div>

      <h3>5. Quên đóng cửa và trộm xu</h3>
      <ul>
        <li>Không bấm <b>Đóng cửa</b>{ftClose?.closeStart != null && ftClose.closeEnd != null ? ` (full-time: ${span(ftClose.closeStart, ftClose.closeEnd)})` : ""} thì sân bị <b>mở cửa</b> từ {fmtMin(rules.stealWindowStart)} đến {rules.stealWindowEnd >= 1440 ? "24:00" : fmtMin(rules.stealWindowEnd)} cùng ngày.</li>
        <li>Đồng nghiệp vào mục <b>🦝 Sân quên đóng cửa</b> ở trang Sân của tôi để trộm: mỗi lần lấy {rules.stealPercent}% số xu trong ví bạn, tối đa {rules.stealMaxCoins} xu.</li>
        <li>Mỗi lần quên đóng cửa, tối đa <b>{rules.stealMaxThieves} người</b> được trộm, mỗi người 1 lần.</li>
        <li>Quên đóng cửa chỉ tính khi hôm đó bạn có đi làm (đã cho ăn ít nhất 1 lần).</li>
      </ul>

      <h3>6. Cuối tháng</h3>
      <ul>
        <li><b>Biến động xu</b> = xu cho ăn + xu trộm được − xu bị trộm (+ điều chỉnh của admin nếu có).</li>
        <li>Admin dùng con số này để tính thưởng: 1 xu = {fmtVnd(rules.coinVnd)}.</li>
        <li>Biến động được đổi thành <b>điểm</b>: 1 xu = {rules.pointsPerCoin} điểm. Tháng âm thì được 0 điểm. Điểm cộng dồn sang tháng sau.</li>
      </ul>

      <h3>7. Mua trứng, nở con mới</h3>
      <ul>
        <li>Dùng điểm bấm nút <b>🥚 Mua trứng</b> ở trang Sân của tôi. Con thứ n giá <b>{rules.eggStep} × (n − 1)</b> điểm: con thứ 2 giá {egg(2)}, con thứ 3 giá {egg(3)}, con thứ {rules.maxPets} giá {egg(rules.maxPets)}.</li>
        <li>Trứng nở ra 1 con ngẫu nhiên, không trùng con bạn đang có. Tối đa {rules.maxPets} con.</li>
        <li>Bạn tự chọn chỗ ở cho từng con trong sân: trong mục <b>Chỗ ở trong sân</b>, bấm 1 con rồi bấm ô muốn chuyển tới.</li>
      </ul>

      <h3>8. Nghỉ phép, nghỉ lễ</h3>
      <ul>
        <li>Ngày lễ chung do admin tạo: không cần cho ăn, không bị tính bỏ bữa.</li>
        <li>Nghỉ phép hoặc nghỉ lễ cá nhân: gửi đơn ở trang <b>Lịch & nghỉ phép</b>. Admin duyệt xong thì những ngày đó không tính xu, không tính bỏ bữa.</li>
        <li>Gửi đơn trước ngày nghỉ để tránh bị tính bỏ bữa.</li>
      </ul>

      <h3>Lưu ý quan trọng</h3>
      <ul className="help-tips">
        {net.mode !== "off" && <li>📶 Chấm công phải dùng <b>Wi-Fi công ty</b>. Dùng 4G hay Wi-Fi ở nhà {net.mode === "enforce" ? "sẽ không bấm được" : "sẽ bị ghi lại để admin kiểm tra"}{net.scope === "login" && net.mode === "enforce" ? ", và ngoài Wi-Fi công ty không vào được web" : ""}.</li>}
        <li>⏰ Đặt nhắc giờ trên điện thoại cho các khung cho ăn và đóng cửa.</li>
        <li>🚪 Tan làm nhớ bấm <b>Đóng cửa</b>, nếu không sẽ bị trộm xu.</li>
        <li>📅 Part-time: lỡ ngày đăng ký ca thì tuần sau không có ca nào.</li>
        <li>📝 Xu sai hoặc bấm mà không được tính: báo admin để điều chỉnh, kèm thời điểm bấm.</li>
        <li>📜 Trang <b>Lịch sử</b> ghi lại mọi lần cho ăn, đóng cửa, trộm và bị trộm.</li>
      </ul>
    </HelpButton>
  );
}
