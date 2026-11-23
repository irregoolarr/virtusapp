import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, roles } from "@/db";
import { requireApiAuth } from "@/lib/auth";
import { badRequest, notFound, parseNumericId } from "@/lib/api-helpers";
import { roleCreateSchema } from "@/lib/validation";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth("rbac:manage");
  if ("error" in auth) return auth.error;

  const { id: rawId } = await context.params;
  const id = parseNumericId(rawId);
  if (!id) return badRequest("Invalid role ID");

  const parsed = roleCreateSchema.partial().safeParse(await req.json());
  if (!parsed.success) {
    return badRequest("Invalid role update", parsed.error.flatten());
  }

  const [existing] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
  if (!existing) return notFound();

  const updatePayload: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.name !== undefined && !existing.isSystem) {
    updatePayload.name = parsed.data.name.trim();
  }
  if (parsed.data.description !== undefined) {
    updatePayload.description = parsed.data.description;
  }
  if (parsed.data.permissions !== undefined) {
    // Keep rbac:manage on super_admin so admin never locks out the platform
    const perms = new Set(parsed.data.permissions);
    if (existing.slug === "super_admin") {
      perms.add("rbac:manage");
      perms.add("users:manage");
      perms.add("settings:manage");
    }
    updatePayload.permissions = Array.from(perms);
  }

  const [updated] = await db
    .update(roles)
    .set(updatePayload)
    .where(eq(roles.id, id))
    .returning();

  return NextResponse.json({ item: updated });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth("rbac:manage");
  if ("error" in auth) return auth.error;

  const { id: rawId } = await context.params;
  const id = parseNumericId(rawId);
  if (!id) return badRequest("Invalid role ID");

  const [existing] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
  if (!existing) return notFound();
  if (existing.isSystem) {
    return badRequest("System default roles cannot be deleted");
  }

  await db.delete(roles).where(eq(roles.id, id));
  return NextResponse.json({ ok: true });
}
