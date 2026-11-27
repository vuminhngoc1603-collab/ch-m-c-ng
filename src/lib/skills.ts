import type { Zodiac } from "@prisma/client";
import type { Rules } from "./rules";

export type SkillInfo = { name: string; text: string; kind: "Xu" | "Trộm" | "Phòng thủ" | "Tiện ích" | "Điểm" };

/** Tên và mô tả kỹ năng theo đúng con số đang cấu hình. */
export function skillInfo(z: Zodiac, rules: Rules): SkillInfo {
  const k = rules.skills;
  switch (z) {
    case "TY": return { name: "Tay nhanh", kind: "Trộm", text: `Khi bạn trộm, mỗi lần lấy tối đa ${k.tyStealMaxCoins} xu thay vì ${rules.stealMaxCoins} xu.` };
    case "SUU": return { name: "Cần cù", kind: "Xu", text: `Tuần nào đi làm mà không bỏ bữa nào: +${k.suuWeeklyCoins} xu vào cuối tuần.` };
    case "DAN": return { name: "Gầm canh cửa", kind: "Phòng thủ", text: `${k.danPerMonth} lần quên đóng cửa đầu tiên mỗi tháng: không ai trộm được sân bạn.` };
    case "MAO": return { name: "Chín mạng", kind: "Phòng thủ", text: `${k.maoPerQuarter} lần mỗi quý, khi 1 con sắp chết thì Mão đỡ đòn: không con nào chết. Vẫn bị phạt ${rules.penaltyVnd.toLocaleString("vi-VN")} đ.` };
    case "THIN": return { name: "Uy rồng", kind: "Xu", text: rules.coefLocked ? `Hệ số cho ăn +${k.thinBonus.toLocaleString("vi-VN")} (hệ số theo số con đang khoá x1, Thìn vẫn cộng).` : `Hệ số cho ăn +${k.thinBonus.toLocaleString("vi-VN")}, không vượt x${rules.coefTable[rules.maxPets - 1]}.` };
    case "TI": return { name: "Nọc độc", kind: "Phòng thủ", text: `Ai đã trộm sân bạn 1 lần thì bị khoá, ${k.tiLockDays} ngày sau mới được trộm sân bạn lần nữa.` };
    case "NGO": return { name: "Phi nước đại", kind: "Trộm", text: `${k.ngoPriorityMinutes} phút đầu khi một sân mở cửa, chỉ người có Ngọ được trộm.` };
    case "MUI": return { name: "Hiền lành", kind: "Phòng thủ", text: `Bị trộm chỉ mất ${k.muiStealPercent}% ví thay vì ${rules.stealPercent}%.` };
    case "THAN": return { name: "Láu lỉnh", kind: "Trộm", text: `${k.thanPerWeek} lần mỗi tuần được trộm sân đã đủ ${rules.stealMaxThieves} người trộm.` };
    case "DAU": return { name: "Gáy sáng", kind: "Tiện ích", text: `Nhắc trên trang Sân của tôi ${k.dauRemindMinutes} phút trước giờ cho ăn.` };
    case "TUAT": return { name: "Trung thành", kind: "Xu", text: `Ngày lễ chung, con tự cho ăn thay bạn: nhận xu như đi làm (tối đa ${k.tuatDaysPerMonth} ngày mỗi tháng).` };
    case "HOI": return { name: "Phúc hậu", kind: "Điểm", text: `Mua trứng giảm ${k.hoiDiscountPercent}% điểm.` };
  }
}

export function skillOn(z: Zodiac, rules: Rules): boolean {
  return rules.skills.enabled.includes(z);
}

/** Danh sách con đang sống có kỹ năng đang bật. */
export function activeSkills(alive: Zodiac[], rules: Rules): Set<Zodiac> {
  return new Set(alive.filter((z) => skillOn(z, rules)));
}
