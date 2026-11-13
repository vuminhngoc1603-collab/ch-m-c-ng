import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { logout, chooseJobTypeAction } from "@/app/actions";
import { Flash } from "@/components/Flash";
import { Help } from "@/components/Help";

export const dynamic = "force-dynamic";

const JOB = { FULLTIME: "Full-time", PARTTIME: "Part-time" } as const;

export default async function PendingPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const u = await currentUser();
  if (!u) redirect("/login");
  if (u.status === "ACTIVE" && u.role) redirect(u.role === "ADMIN" ? "/admin" : "/");
  const sp = await searchParams;
  const chosen = u.requestedRole === "FULLTIME" || u.requestedRole === "PARTTIME" ? u.requestedRole : null;

  if (u.status === "DISABLED") {
    return (
      <main className="login">
        <div className="card">
          <div style={{ fontSize: 48 }}>🔒</div>
          <h1>Tài khoản đã bị khoá</h1>
          <p className="muted">Liên hệ admin nếu bạn nghĩ đây là nhầm lẫn.</p>
          <form action={logout}><button className="btn" type="submit">Đăng xuất</button></form>
        </div>
      </main>
    );
  }

  return (
    <main className="login">
      <div className="card">
        <div style={{ fontSize: 48 }}>🥚</div>
        <h1>{chosen ? "Đang chờ admin duyệt" : "Bạn làm loại công việc nào?"}</h1>
        <Flash ok={sp.ok} err={sp.err} />
        <p className="muted">
          {chosen
            ? <>Tài khoản <b>{u.email}</b> đăng ký làm <b>{JOB[chosen]}</b>. Khi admin duyệt, bạn nhận con giáp đầu tiên miễn phí.</>
            : <>Chọn đúng loại công việc để hệ thống tính giờ cho ăn và đóng cửa cho bạn.</>}
        </p>

        <form action={chooseJobTypeAction} className="job-pick">
          <label className={`job-opt ${chosen === "FULLTIME" ? "on" : ""}`}>
            <input type="radio" name="jobType" value="FULLTIME" defaultChecked={chosen === "FULLTIME"} required />
            <span><b>Full-time</b><br /><span className="muted small">Thứ Hai đến thứ Sáu, giờ cố định. Không cần đăng ký ca.</span></span>
          </label>
          <label className={`job-opt ${chosen === "PARTTIME" ? "on" : ""}`}>
            <input type="radio" name="jobType" value="PARTTIME" defaultChecked={chosen === "PARTTIME"} required />
            <span><b>Part-time</b><br /><span className="muted small">Tự đăng ký ca P1–P5 cho tuần sau vào mỗi thứ Sáu.</span></span>
          </label>
          <button className="btn primary" type="submit">{chosen ? "Đổi loại công việc" : "Gửi đăng ký"}</button>
        </form>

        <div className="help-corner"><span className="muted small">Đọc trước cách chơi</span><Help /></div>
        <form action={logout} style={{ marginTop: 12 }}><button className="btn" type="submit">Đăng xuất</button></form>
      </div>
    </main>
  );
}
