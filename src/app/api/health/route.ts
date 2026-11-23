import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    const g = globalThis as unknown as {
      __virtusSchedulerStarted?: boolean;
      __virtusSchedulerLastBeat?: string;
    };
    return NextResponse.json({
      ok: true,
      database: "postgresql",
      schedulerActive: Boolean(g.__virtusSchedulerStarted),
      schedulerLastBeat: g.__virtusSchedulerLastBeat ?? null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Database unavailable",
      },
      { status: 500 }
    );
  }
}
