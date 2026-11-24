import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db, sessions, users } from "@/db";
import { SESSION_COOKIE_NAME, getCurrentUser, hashPassword, hashSessionToken, verifyPassword } from "@/lib/auth";
import { badRequest } from "@/lib/api-helpers";

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters").max(200),
});

/** Change the signed-in user's own password; signs out their other sessions. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const parsed = passwordSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid password");
  const { currentPassword, newPassword } = parsed.data;

  const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, user.id)).limit(1);
  if (!row || !verifyPassword(currentPassword, row.passwordHash)) {
    return badRequest("Current password is incorrect");
  }
  if (currentPassword === newPassword) return badRequest("New password must be different from the current one");

  await db.update(users).set({ passwordHash: hashPassword(newPassword), updatedAt: new Date() }).where(eq(users.id, user.id));

  const rawToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (rawToken) {
    await db.delete(sessions).where(and(eq(sessions.userId, user.id), ne(sessions.tokenHash, hashSessionToken(rawToken))));
  }

  return NextResponse.json({ ok: true });
}
