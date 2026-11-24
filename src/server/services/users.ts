import { and, asc, eq, ne } from "drizzle-orm";
import { db, roles, sessions, users } from "@/db";
import { hashPassword, hashSessionToken, verifyPassword } from "@/lib/auth";
import { ApiError, badRequest, notFound, serialize } from "@/server/http";
import type { TeamMember } from "@/shared/types";
import { passwordChangeSchema, profileNameSchema, userCreateSchema, userUpdateSchema } from "@/shared/schemas";
import type { z } from "zod";

/** Public user columns — the password hash is never selected. */
const publicColumns = {
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
};

export async function listTeam(): Promise<TeamMember[]> {
  const rows = await db
    .select({
      ...publicColumns,
      roleName: roles.name,
      roleSlug: roles.slug,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .orderBy(asc(users.id));
  return rows.map(serialize);
}

export async function createUser(d: z.output<typeof userCreateSchema>) {
  const email = d.email.trim().toLowerCase();
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) throw new ApiError(409, "Email already exists");
  const [created] = await db
    .insert(users)
    .values({
      name: d.name.trim(),
      email,
      passwordHash: hashPassword(d.password),
      jobTitle: d.jobTitle.trim(),
      department: d.department.trim(),
      phone: d.phone ?? null,
      avatarColor: d.avatarColor,
      availability: d.availability,
      isActive: d.isActive,
      roleId: d.roleId,
    })
    .returning({ ...publicColumns, createdAt: users.createdAt });
  return serialize(created);
}

export async function updateUser(id: number, d: z.output<typeof userUpdateSchema>) {
  const patch = {
    updatedAt: new Date(),
    ...(d.name !== undefined && { name: d.name.trim() }),
    ...(d.jobTitle !== undefined && { jobTitle: d.jobTitle.trim() }),
    ...(d.department !== undefined && { department: d.department.trim() }),
    ...(d.phone !== undefined && { phone: d.phone }),
    ...(d.availability !== undefined && { availability: d.availability }),
    ...(d.isActive !== undefined && { isActive: d.isActive }),
    ...(d.roleId !== undefined && { roleId: d.roleId }),
    ...(d.password !== undefined && { passwordHash: hashPassword(d.password) }),
  };
  const [updated] = await db.update(users).set(patch).where(eq(users.id, id)).returning(publicColumns);
  if (!updated) throw notFound();
  return updated;
}

export async function deleteUser(id: number, actorId: number): Promise<void> {
  if (id === actorId) throw badRequest("You cannot delete your own active session account");
  const [deleted] = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
  if (!deleted) throw notFound();
}

// ---- Self-service profile --------------------------------------------------

export async function updateOwnName(userId: number, d: z.output<typeof profileNameSchema>): Promise<string> {
  const name = [d.firstName, d.lastName].filter(Boolean).join(" ");
  if (name.length < 2) throw badRequest("Name must be at least 2 characters");
  await db.update(users).set({ name, updatedAt: new Date() }).where(eq(users.id, userId));
  return name;
}

/** Change own password; keeps the current session and signs out all others. */
export async function changeOwnPassword(
  userId: number,
  d: z.output<typeof passwordChangeSchema>,
  currentRawToken: string | undefined
): Promise<void> {
  const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1);
  if (!row || !verifyPassword(d.currentPassword, row.passwordHash)) throw badRequest("Current password is incorrect");
  if (d.currentPassword === d.newPassword) throw badRequest("New password must be different from the current one");

  await db.update(users).set({ passwordHash: hashPassword(d.newPassword), updatedAt: new Date() }).where(eq(users.id, userId));
  if (currentRawToken) {
    await db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.tokenHash, hashSessionToken(currentRawToken))));
  }
}
