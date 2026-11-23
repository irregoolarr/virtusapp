import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db, roles, users } from "@/db";
import { hashPassword, requireApiAuth } from "@/lib/auth";
import { badRequest } from "@/lib/api-helpers";
import { userCreateSchema } from "@/lib/validation";

export async function GET() {
  const auth = await requireApiAuth("users:read");
  if ("error" in auth) return auth.error;

  const rows = await db
    .select({
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
      roleName: roles.name,
      roleSlug: roles.slug,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .orderBy(asc(users.id));

  return NextResponse.json({ items: rows });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth("users:manage");
  if ("error" in auth) return auth.error;

  const parsed = userCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return badRequest("Invalid user payload", parsed.error.flatten());
  }

  const d = parsed.data;
  const normalizedEmail = d.email.trim().toLowerCase();
  const existing = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
  if (existing.length > 0) {
    return NextResponse.json({ error: "Email already exists" }, { status: 409 });
  }

  const [created] = await db
    .insert(users)
    .values({
      name: d.name.trim(),
      email: normalizedEmail,
      passwordHash: hashPassword(d.password),
      jobTitle: d.jobTitle.trim(),
      department: d.department.trim(),
      phone: d.phone ?? null,
      avatarColor: d.avatarColor,
      availability: d.availability,
      isActive: d.isActive,
      roleId: d.roleId,
    })
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
      createdAt: users.createdAt,
    });

  return NextResponse.json({ item: created }, { status: 201 });
}
