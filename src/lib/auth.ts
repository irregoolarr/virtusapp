import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { db, roles, sessions, users } from "@/db";
import { hasPermission, PermissionKey } from "./rbac";

export const SESSION_COOKIE_NAME = "virtus_session";
const SESSION_TTL_DAYS = 7;

export interface AuthenticatedUser {
  id: number;
  name: string;
  email: string;
  jobTitle: string;
  department: string;
  phone: string | null;
  avatarColor: string;
  availability: string;
  isActive: boolean;
  roleId: number;
  roleName: string;
  roleSlug: string;
  permissions: string[];
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(":");
  if (!salt || !keyHex) return false;
  const keyBuf = Buffer.from(keyHex, "hex");
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

export function hashSessionToken(rawToken: string): string {
  const secret = process.env.SESSION_SECRET ?? "virtusms-local-session-secret";
  return crypto.createHmac("sha256", secret).update(rawToken).digest("hex");
}

export async function createSession(userId: number): Promise<{ rawToken: string; expiresAt: Date }> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({
    tokenHash,
    userId,
    expiresAt,
  });

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  return { rawToken, expiresAt };
}

export async function destroySessionByRawToken(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  const tokenHash = hashSessionToken(rawToken);
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

export async function getUserFromRawToken(rawToken: string | undefined): Promise<AuthenticatedUser | null> {
  if (!rawToken) return null;
  const tokenHash = hashSessionToken(rawToken);
  const rows = await db
    .select({
      user: users,
      role: roles,
      session: sessions,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (rows.length === 0) return null;
  const { user, role } = rows[0];
  if (!user.isActive) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    jobTitle: user.jobTitle,
    department: user.department,
    phone: user.phone,
    avatarColor: user.avatarColor,
    availability: user.availability,
    isActive: user.isActive,
    roleId: role.id,
    roleName: role.name,
    roleSlug: role.slug,
    permissions: Array.isArray(role.permissions) ? role.permissions : [],
  };
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return getUserFromRawToken(token);
}

export async function requireApiAuth(
  permission?: PermissionKey
): Promise<{ user: AuthenticatedUser } | { error: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }
  if (permission && !hasPermission(user.permissions, permission)) {
    return {
      error: NextResponse.json(
        { error: `Missing permission: ${permission}` },
        { status: 403 }
      ),
    };
  }
  return { user };
}
