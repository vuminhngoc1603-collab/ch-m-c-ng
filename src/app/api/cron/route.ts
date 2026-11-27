import { NextResponse } from "next/server";
import { runTick } from "@/server/tick";
import { syncPublicHolidays } from "@/server/holidays";

export const dynamic = "force-dynamic";

// Gọi mỗi 5 phút (Vercel Cron, cron-job.org, ...) với header Authorization: Bearer <CRON_SECRET>
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const q = new URL(req.url).searchParams.get("secret");
  if (!secret || (auth !== `Bearer ${secret}` && q !== secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Lịch nghỉ lễ nhà nước năm nay + năm sau luôn có sẵn trước khi quét lượt cho ăn.
  const holidays = await syncPublicHolidays(new Date());
  const stats = await runTick(new Date());
  return NextResponse.json({ ok: true, stats, holidays });
}
