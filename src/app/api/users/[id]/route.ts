import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, users } from "@/db";
import { hashPassword, requireApiAuth } from "@/lib/auth";
import { badRequest, notFound, parseNumericId } from "@/lib/api-helpers";

const userUpdateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  jobTitle: z.string().min(2).max(120).optional(),
  department: z.string().min(2).max(100).optional(),
  phone: z.string().optional().nullable(),
  availability: z.enum(["Online", "On Duty", "Away", "Offline"]).optional(),
  isActive: z.boolean().optional(),
  roleId: z.number().int().positive().optional(),
  password: z.string().min(6).optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth("users:manage");
  if ("error" in auth) return auth.error;

  const { id: rawId } = await context.params;
  const id = parseNumericId(rawId);
  if (!id) return badRequest("Invalid ID");

  const parsed = userUpdateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return badRequest("Invalid user update", parsed.error.flatten());
  }

  const d = parsed.data;
  const updatePayload: Record<string, unknown> = { updatedAt: new Date() };
  if (d.name !== undefined) updatePayload.name = d.name.trim();
  if (d.jobTitle !== undefined) updatePayload.jobTitle = d.jobTitle.trim();
  if (d.department !== undefined) updatePayload.department = d.department.trim();
  if (d.phone !== undefined) updatePayload.phone = d.phone;
  if (d.availability !== undefined) updatePayload.availability = d.availability;
  if (d.isActive !== undefined) updatePayload.isActive = d.isActive;
  if (d.roleId !== undefined) updatePayload.roleId = d.roleId;
  if (d.password !== undefined) updatePayload.passwordHash = hashPassword(d.password);

  const [updated] = await db
    .update(users)
    .set(updatePayload)
    .where(eq(users.id, id))
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      jobTitle: users.jobTitle,
      department: users.department,
      phone: users.phone,
      avatarColor: users.avatarColor,
      availability: users.availability,
      isActive: users.isActive,
      roleId: users.roleId,
    });

  if (!updated) return notFound();
  return NextResponse.json({ item: updated });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth("users:manage");
  if ("error" in auth) return auth.error;

  const { id: rawId } = await context.params;
  const id = parseNumericId(rawId);
  if (!id) return badRequest("Invalid ID");
  if (id === auth.user.id) {
    return badRequest("You cannot delete your own active session account");
  }

  const [deleted] = await db.delete(users).where(eq(users.id, id)).returning();
  if (!deleted) return notFound();
  return NextResponse.json({ ok: true });
}
