import { asc, eq, sql } from "drizzle-orm";
import { db, roles, users } from "@/db";
import { PERMISSIONS } from "@/lib/rbac";
import { ApiError, badRequest, notFound, serialize } from "@/server/http";
import type { RolesResponse } from "@/shared/types";
import { roleCreateSchema } from "@/shared/schemas";
import type { z } from "zod";

type RoleInput = z.output<typeof roleCreateSchema>;

/** Permissions the super_admin role always keeps, so admins can't lock themselves out. */
const SUPER_ADMIN_FLOOR = ["rbac:manage", "users:manage", "settings:manage"];

export async function listRoles(): Promise<RolesResponse> {
  const [roleRows, userCounts] = await Promise.all([
    db.select().from(roles).orderBy(asc(roles.id)),
    db.select({ roleId: users.roleId, count: sql<number>`count(*)::int` }).from(users).groupBy(users.roleId),
  ]);
  const countMap = new Map(userCounts.map((u) => [u.roleId, u.count]));
  return {
    items: roleRows.map((r) => serialize({ ...r, memberCount: countMap.get(r.id) ?? 0 })),
    availablePermissions: PERMISSIONS,
  };
}

export async function createRole(d: RoleInput) {
  const base = d.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  const [created] = await db
    .insert(roles)
    .values({
      name: d.name.trim(),
      slug: `${base}_${Date.now().toString().slice(-4)}`,
      description: d.description,
      permissions: d.permissions,
      isSystem: false,
    })
    .returning();
  return serialize(created);
}

export async function updateRole(id: number, d: Partial<RoleInput>) {
  const [existing] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
  if (!existing) throw notFound();

  let permissions: string[] | undefined;
  if (d.permissions !== undefined) {
    const set = new Set(d.permissions);
    if (existing.slug === "super_admin") SUPER_ADMIN_FLOOR.forEach((p) => set.add(p));
    permissions = Array.from(set);
  }

  const [updated] = await db
    .update(roles)
    .set({
      updatedAt: new Date(),
      // System role names are fixed.
      ...(d.name !== undefined && !existing.isSystem && { name: d.name.trim() }),
      ...(d.description !== undefined && { description: d.description }),
      ...(permissions && { permissions }),
    })
    .where(eq(roles.id, id))
    .returning();
  return serialize(updated);
}

export async function deleteRole(id: number): Promise<void> {
  const [existing] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
  if (!existing) throw notFound();
  if (existing.isSystem) throw badRequest("System default roles cannot be deleted");
  // users.role_id has no ON DELETE rule, so a role in use would fail with a database error.
  const [{ members }] = await db
    .select({ members: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.roleId, id));
  if (members > 0) {
    throw new ApiError(
      409,
      `${members} member${members === 1 ? "" : "s"} still ${members === 1 ? "has" : "have"} the role "${existing.name}". Move them to another role first.`
    );
  }
  await db.delete(roles).where(eq(roles.id, id));
}
