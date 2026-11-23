import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { customers, db } from "@/db";
import { requireApiAuth } from "@/lib/auth";
import { badRequest, notFound, parseNumericId } from "@/lib/api-helpers";
import { customerCreateSchema } from "@/lib/validation";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth("customers:write");
  if ("error" in auth) return auth.error;

  const { id: rawId } = await context.params;
  const id = parseNumericId(rawId);
  if (!id) return badRequest("Invalid ID");

  const parsed = customerCreateSchema.partial().safeParse(await req.json());
  if (!parsed.success) {
    return badRequest("Invalid customer update", parsed.error.flatten());
  }

  const [updated] = await db
    .update(customers)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(customers.id, id))
    .returning();

  if (!updated) return notFound();
  return NextResponse.json({ item: updated });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth("customers:delete");
  if ("error" in auth) return auth.error;

  const { id: rawId } = await context.params;
  const id = parseNumericId(rawId);
  if (!id) return badRequest("Invalid ID");

  const [deleted] = await db
    .delete(customers)
    .where(eq(customers.id, id))
    .returning();

  if (!deleted) return notFound();
  return NextResponse.json({ ok: true });
}
