import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, roles, users } from "@/db";
import { createSession, SESSION_COOKIE_NAME, verifyPassword } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Valid email and password are required" },
        { status: 400 }
      );
    }

    const email = parsed.data.email.trim().toLowerCase();
    const rows = await db
      .select({ user: users, role: roles })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.email, email))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const { user, role } = rows[0];
    if (!user.isActive) {
      return NextResponse.json(
        { error: "Account is deactivated. Contact your Super Admin." },
        { status: 403 }
      );
    }

    const valid = verifyPassword(parsed.data.password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const { rawToken, expiresAt } = await createSession(user.id);
    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        jobTitle: user.jobTitle,
        department: user.department,
        avatarColor: user.avatarColor,
        availability: user.availability,
        roleName: role.name,
        roleSlug: role.slug,
        permissions: role.permissions,
      },
    });

    response.cookies.set(SESSION_COOKIE_NAME, rawToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Login failed" },
      { status: 500 }
    );
  }
}
