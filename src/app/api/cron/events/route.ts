import { NextRequest, NextResponse } from "next/server";
import { processDueEvents } from "@/lib/mailer";

export const dynamic = "force-dynamic";

// Triggered by Vercel Cron (vercel.json) or the GitHub Actions scheduler.
// Vercel Cron automatically sends `Authorization: Bearer $CRON_SECRET`.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processDueEvents();
  return NextResponse.json({ ranAt: new Date().toISOString(), ...result });
}
