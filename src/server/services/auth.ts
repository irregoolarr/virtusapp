import { eq } from "drizzle-orm";
import { db, roles, users } from "@/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { ApiError } from "@/server/http";

/** Verify credentials and open a session. Throws 401/403 ApiErrors. */
export async function signIn(rawEmail: string, password: string) {
  const email = rawEmail.trim().toLowerCase();
  const [row] = await db
    .select({ user: users, role: roles })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.email, email))
    .limit(1);

  // Same message for unknown email and wrong password, so emails can't be probed.
  if (!row) throw new ApiError(401, "Invalid credentials");
  const { user, role } = row;
  if (!user.isActive) throw new ApiError(403, "Account is deactivated. Contact your Super Admin.");
  if (!verifyPassword(password, user.passwordHash)) throw new ApiError(401, "Invalid credentials");

  const session = await createSession(user.id);
  return {
    session,
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
  };
}
