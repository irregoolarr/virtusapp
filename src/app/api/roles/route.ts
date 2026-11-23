import { NextRequest, NextResponse } from "next/server";
import { asc, sql } from "drizzle-orm";
import { db, roles, users } from "@/db";
import { requireApiAuth } from "@/lib/auth";
import { badRequest } from "@/lib/api-helpers";
import { PERMISSIONS } from "@/lib/rbac";
import { roleCreateSchema } from "@/lib/validation";

export async function GET() {
  const auth = await requireApiAuth("users:read");
  if ("error" in auth) return auth.error;

  const [roleRows, userCounts] = await Promise.all([
    db.select().from(roles).orderBy(asc(roles.id)),
    db
      .select({ roleId: users.roleId, count: sql<number>`count(*)::int` })
      .from(users)
      .groupBy(users.roleId),
  ]);

  const countMap = new Map(userCounts.map((u) => [u.roleId, u.count]));
  const items = roleRows.map((r) => ({
    ...r,
    memberCount: countMap.get(r.id) ?? 0,
  }));

  return NextResponse.json({ items, availablePermissions: PERMISSIONS });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth("rbac:manage");
  if ("error" in auth) return auth.error;

  const parsed = roleCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return badRequest("Invalid role payload", parsed.error.flatten());
  }

  const slug = parsed.data.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  const [created] = await db
    .insert(roles)
    .values({
      name: parsed.data.name.trim(),
      slug: `${slug}_${Date.now().toString().slice(-4)}`,
      description: parsed.data.description,
      permissions: parsed.data.permissions,
      isSystem: false,
    })
    .returning();

  return NextResponse.json({ item: created }, { status: 201 });
}
