import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { computeMonth, toCsv } from "@/server/settlement";
import { vn } from "@/lib/time";

export async function GET(req: Request) {
  const u = await currentUser();
  if (!u || u.role !== "ADMIN" || u.status !== "ACTIVE") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const period = new URL(req.url).searchParams.get("period") ?? vn(new Date()).period;
  if (!/^\d{4}-\d{2}$/.test(period)) return NextResponse.json({ error: "bad period" }, { status: 400 });
  const csv = toCsv(await computeMonth(period));
  return new NextResponse(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="bien-dong-xu-${period}.csv"` },
  });
}
