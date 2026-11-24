import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, users } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { badRequest } from "@/lib/api-helpers";

const nameSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().max(60).default(""),
});

/** Update the signed-in user's own first / last name. */
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const parsed = nameSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid name");

  const name = [parsed.data.firstName, parsed.data.lastName].filter(Boolean).join(" ");
  if (name.length < 2) return badRequest("Name must be at least 2 characters");

  await db.update(users).set({ name, updatedAt: new Date() }).where(eq(users.id, user.id));
  return NextResponse.json({ ok: true, name });
}
