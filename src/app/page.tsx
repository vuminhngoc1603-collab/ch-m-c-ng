import { prisma } from "@/lib/db";
import { requireStaff, requestMeta } from "@/lib/session";
import { checkNetwork } from "@/server/network";
import { Nav } from "@/components/Nav";
import { Flash } from "@/components/Flash";
import { Yard } from "@/components/Yard";
import { maybeTick } from "@/server/tick";
import { todaySlots } from "@/server/attendance";
import { coinBalance, pointBalance } from "@/server/wallet";
import { stealableYards } from "@/server/theft";
import { getRules } from "@/server/settings";
import { eggPrice, feedCents, fmtCoins, inWindow } from "@/lib/rules";
import { fmtDay, fmtMin, fmtDateTime, vn } from "@/lib/time";
import { ZODIAC, ZODIAC_NECK, zodiacImage } from "@/lib/zodiac";
import { Garden } from "@/components/Garden";
import { activeSkills, skillInfo } from "@/lib/skills";
import { ALL_ZODIAC } from "@/lib/zodiac";
import { RulesPanel } from "@/components/RulesPanel";
import { rigFor } from "@/lib/rig";
import { feedAction, closeAction, stealAction, buyEggAction } from "@/app/actions";

export const dynamic = "force-dynamic";

const FEED_LABEL = { PENDING: ["Chưa cho ăn", ""], FED: ["Đã cho ăn", "good"], MISSED: ["Bỏ bữa", "bad"], EXCUSED: ["Được miễn", ""] } as const;
const CLOSE_LABEL = { NONE: ["", ""], PENDING: ["Chưa đóng cửa", ""], CLOSED: ["Đã đóng cửa", "good"], FORGOT: ["Quên đóng cửa", "bad"], SKIPPED: ["Không cần đóng", ""] } as const;

export default async function Home({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireStaff();
  const sp = await searchParams;
  const now = new Date();
  await maybeTick(now);
  const v = vn(now);
  const [rules, slots, coins, points, pets, stealable, me, monthMisses, robbedToday] = await Promise.all([
    getRules(),
    todaySlots(user.id, now),
    coinBalance(user.id),
    pointBalance(user.id),
    prisma.pet.findMany({ where: { userId: user.id, status: "ALIVE" }, orderBy: { slot: "asc" } }),
    stealableYards(user.id, now),
    prisma.user.findUniqueOrThrow({ where: { id: user.id } }),
    prisma.attendance.count({ where: { userId: user.id, feedStatus: "MISSED", day: { gte: `${v.period}-01`, lte: `${v.period}-31` } } }),
    prisma.theft.findMany({ where: { victimId: user.id, attendance: { day: v.day } }, include: { thief: true } }),
  ]);
  const sk = activeSkills(pets.map((p) => p.zodiac), rules);
  const coef = feedCents(pets.length, rules, sk.has("THIN") ? rules.skills.thinBonus : 0) / 100;
  const price = eggPrice(pets.length, rules, sk.has("HOI") ? rules.skills.hoiDiscountPercent : 0);
  // Dậu "Gáy sáng": nhắc trước giờ cho ăn.
  const nextFeed = slots.find((s) => s.feedStatus === "PENDING" && s.shift.feedStart >= v.minutes);
  const dauIn = sk.has("DAU") && nextFeed ? nextFeed.shift.feedStart - v.minutes : null;
  // Bộ đếm tính chết: đếm lại từ 0 sau mỗi lần chết.
  const deathMisses = me.monthMissPeriod === v.period ? me.monthMisses : 0;
  const mood: "ok" | "hungry" | "critical" =
    me.missStreak >= rules.deathStreak - 1 || deathMisses >= rules.deathMonthly - 1 ? "critical" : me.missStreak >= 1 ? "hungry" : "ok";
  const net = await checkNetwork(user, (await requestMeta()).ip);
  const offNet = net.policy.mode !== "off" && !net.network && !net.exempt;
  const canFeed = net.allowed && slots.some((s) => s.feedStatus === "PENDING" && inWindow(v.minutes, s.shift.feedStart, s.shift.feedEnd));
  const canClose = net.allowed && slots.some((s) => s.closeStatus === "PENDING" && inWindow(v.minutes, s.shift.closeStart, s.shift.closeEnd));
  const stealOpen = v.minutes >= rules.stealWindowStart && v.minutes < rules.stealWindowEnd;

  return (
    <>
      <Nav user={user} />
      <main className="container grid">
        <div>
          <h1>Chào {user.name ?? user.email} 👋</h1>
          <div className="muted">{fmtDay(v.day)} · {fmtMin(v.minutes)} · {user.role === "FULLTIME" ? "Full-time" : "Part-time"}</div>
        </div>
        <Flash ok={sp.ok} err={sp.err} />
        {dauIn != null && dauIn <= rules.skills.dauRemindMinutes && nextFeed && (
          <div className="flash ok">🐔 Gà gáy! Còn {dauIn} phút nữa tới giờ cho ăn {nextFeed.shift.name} ({fmtMin(nextFeed.shift.feedStart)}–{fmtMin(nextFeed.shift.feedEnd)}).</div>
        )}
        {offNet && (
          <div className="flash err">
            📶 Bạn đang không dùng Wi-Fi công ty{net.ip ? ` (mạng ${net.ip})` : ""}.{" "}
            {net.policy.mode === "enforce" ? "Nút Cho ăn và Đóng cửa bị khoá cho tới khi bạn kết nối Wi-Fi công ty." : "Lượt chấm công lúc này sẽ được ghi lại để admin kiểm tra."}
          </div>
        )}

        {mood !== "ok" && (
          <div className={`flash ${mood === "critical" ? "err" : ""}`} style={mood === "hungry" ? { background: "var(--warn-bg)", color: "var(--warn)" } : undefined}>
            {mood === "critical"
              ? `⚠️ Con giáp đang nguy kịch: đã bỏ ${me.missStreak}/${rules.deathStreak} bữa liên tiếp, ${deathMisses}/${rules.deathMonthly} bữa trong tháng. Bỏ thêm 1 bữa nữa sẽ làm 1 con chết (phạt ${rules.penaltyVnd.toLocaleString("vi-VN")} đ).`
              : `🍂 Con giáp đang đói: đã bỏ ${me.missStreak} bữa liên tiếp.`}
          </div>
        )}
        {me.regrantOn && pets.length === 0 && <div className="flash ok">Con giáp cuối cùng đã chết. Ngày {me.regrantOn} bạn sẽ được cấp con mới.</div>}
        {robbedToday.length > 0 && (
          <div className="flash err">
            Bạn quên đóng cửa và bị trộm: {robbedToday.map((t) => `${t.thief.name ?? t.thief.email} lấy ${fmtCoins(t.amount)} xu`).join(", ")}.
          </div>
        )}

        <div className="stats">
          <div className="stat"><div className="label">Ví xu</div><div className="value">{fmtCoins(coins)}</div><div className="muted small">≈ {(Math.round((coins * rules.coinVnd) / 100)).toLocaleString("vi-VN")} đ</div></div>
          <div className="stat"><div className="label">Điểm mua trứng</div><div className="value">{points}</div></div>
          <div className="stat"><div className="label">Hệ số hiện tại</div><div className="value">x{coef.toLocaleString("vi-VN")}</div><div className="muted small">{pets.length}/{rules.maxPets} con</div></div>
          <div className="stat"><div className="label">Bỏ bữa tháng này</div><div className="value">{monthMisses}</div><div className="muted small">liên tiếp: {me.missStreak}/{rules.deathStreak} · tính chết: {deathMisses}/{rules.deathMonthly}</div></div>
        </div>

        <div className="garden-layout">
        <RulesPanel role={user.role!} />
        <section className="card garden-card">
          <div className="row space"><h2>Khu vườn của tôi</h2><span className="muted small">Bấm vào con giáp để xem tên</span></div>
          <Garden mood={mood} pets={pets.map((p) => ({ id: p.id, slot: p.slot, img: zodiacImage(p.zodiac), name: ZODIAC[p.zodiac].name, neck: ZODIAC_NECK[p.zodiac], code: p.zodiac.toLowerCase(), rig: rigFor(p.zodiac) }))} />
        </section>
        </div>

        <div className="grid cols-2">
          <section className="card">
            <h2>Hôm nay</h2>
            {slots.length === 0 ? (
              <p className="muted">Hôm nay bạn không có lượt cho ăn nào{user.role === "PARTTIME" ? " (chưa đăng ký ca)" : ""}.</p>
            ) : (
              slots.map((s) => (
                <div className="slot" key={s.id}>
                  <div>
                    <b>{s.shift.name}</b>
                    <div className="muted small">
                      Cho ăn {fmtMin(s.shift.feedStart)}–{fmtMin(s.shift.feedEnd)}
                      {s.shift.closeStart != null && <> · Đóng cửa {fmtMin(s.shift.closeStart)}–{fmtMin(s.shift.closeEnd!)}</>}
                    </div>
                    {s.feedAt && <div className="muted small">Cho ăn lúc {fmtDateTime(s.feedAt)} (+{fmtCoins(s.coinsEarned)} xu)</div>}
                    {s.closeAt && <div className="muted small">Đóng cửa lúc {fmtDateTime(s.closeAt)}</div>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span className={`badge ${FEED_LABEL[s.feedStatus][1]}`}>{FEED_LABEL[s.feedStatus][0]}</span>
                    {s.closeStatus !== "NONE" && <div><span className={`badge ${CLOSE_LABEL[s.closeStatus][1]}`}>{CLOSE_LABEL[s.closeStatus][0]}</span></div>}
                  </div>
                </div>
              ))
            )}
            <div className="actions">
              <form action={feedAction}><button className="btn primary big" disabled={!canFeed}>🍚 Cho ăn (check in)</button></form>
              <form action={closeAction}><button className="btn big" disabled={!canClose}>🔒 Đóng cửa (check out)</button></form>
            </div>
            <p className="muted small">Mỗi lần cho ăn được {rules.coefLocked ? "1 xu" : "1 xu × hệ số"}. Quên đóng cửa thì từ 17h30–24h00 người khác được trộm xu của bạn.</p>
          </section>

          <section className="card">
            <div className="row space"><h2>Chỗ ở trong sân</h2><span className="muted small">{pets.length}/{rules.maxPets}</span></div>
            <Yard
              size={rules.maxPets}
              mood={mood}
              pets={pets.map((p) => ({ id: p.id, slot: p.slot, img: zodiacImage(p.zodiac), name: ZODIAC[p.zodiac].name }))}
            />
            <form action={buyEggAction} className="row" style={{ marginTop: 14 }}>
              <button className="btn primary" disabled={pets.length >= rules.maxPets || points < price}>
                🥚 Mua trứng ({price} điểm)
              </button>
              {sk.has("HOI") && <span className="badge good">Hợi giảm {rules.skills.hoiDiscountPercent}%</span>}
              <span className="muted small">
                {pets.length >= rules.maxPets ? "Sân đã đủ 12 con." : points < price ? `Cần thêm ${price - points} điểm. Điểm được quy đổi từ biến động xu cuối tháng.` : "Trứng nở ra 1 con giáp ngẫu nhiên chưa có trong sân."}
              </span>
            </form>
          </section>
        </div>

        <section className="card">
          <div className="row space"><h2>✨ Kỹ năng con giáp</h2><span className="muted small">Đang có tác dụng: {sk.size}/{ALL_ZODIAC.length}</span></div>
          <p className="muted small">Mỗi con có 1 kỹ năng, chỉ có tác dụng khi con đó còn sống trong sân của bạn. Mua trứng để có thêm kỹ năng.</p>
          <div className="skill-grid">
            {ALL_ZODIAC.map((z) => {
              const info = skillInfo(z, rules);
              const on = sk.has(z);
              const off = !rules.skills.enabled.includes(z);
              return (
                <div key={z} className={`skill ${on ? "on" : ""}`}>
                  <img src={zodiacImage(z)} alt="" width={40} height={40} />
                  <div>
                    <div className="skill-name">{ZODIAC[z].name} · {info.name} {on ? <span className="badge good">Đang có</span> : off ? <span className="badge">Admin tắt</span> : null}</div>
                    <div className="muted small">{info.text}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card">
          <h2>🦝 Sân quên đóng cửa</h2>
          {!stealOpen ? (
            <p className="muted">Chỉ được trộm từ {fmtMin(rules.stealWindowStart)} đến {fmtMin(rules.stealWindowEnd)}.</p>
          ) : stealable.length === 0 ? (
            <p className="muted">Hiện không có sân nào quên đóng cửa.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Chủ sân</th><th>Lượt</th><th className="num">Đã bị trộm</th><th className="num">Bạn lấy được</th><th></th></tr></thead>
                <tbody>
                  {stealable.map((s) => (
                    <tr key={s.attendanceId}>
                      <td>{s.victim.name ?? s.victim.email}</td>
                      <td>{s.shiftName}</td>
                      <td className="num">{s.thieves}/{rules.stealMaxThieves}{s.viaThan && <> <span className="badge good">Thân lẻn vào</span></>}</td>
                      <td className="num">{fmtCoins(s.amount)} xu</td>
                      <td><form action={stealAction}><input type="hidden" name="attendanceId" value={s.attendanceId} /><button className="btn">Trộm</button></form></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
