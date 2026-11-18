import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { monthRoster, rosterCsv } from "@/server/roster";
import { vn } from "@/lib/time";

export async function GET(req: Request) {
  const u = await currentUser();
  if (!u || u.role !== "ADMIN" || u.status !== "ACTIVE") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const sp = new URL(req.url).searchParams;
  const period = sp.get("period") ?? vn(new Date()).period;
  if (!/^\d{4}-\d{2}$/.test(period)) return NextResponse.json({ error: "bad period" }, { status: 400 });
  const csv = rosterCsv(await monthRoster(period, { userId: sp.get("user") || undefined }));
  return new NextResponse(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="ca-lam-${period}.csv"` },
  });
}
