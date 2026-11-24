// Bootstrap a clean database: the default RBAC roles and one Super Admin.
// No demo/business data is created.
//
//   ADMIN_EMAIL=you@company.com ADMIN_PASSWORD='at-least-8-chars' [ADMIN_NAME='Jane Doe'] pnpm db:seed
//
// Safe to re-run: roles are upserted by slug and the admin is only created
// when no user exists yet.
import { eq, sql } from "drizzle-orm";
import { db, pool, roles, users } from "./index";
import { hashPassword } from "../lib/auth";
import { DEFAULT_ROLE_DEFINITIONS } from "../lib/rbac";

async function seed() {
  console.log("Bootstrapping VirtusMS database (roles + first admin)...");

  const roleIds = new Map<string, number>();
  for (const def of DEFAULT_ROLE_DEFINITIONS) {
    const [existing] = await db.select().from(roles).where(eq(roles.slug, def.slug)).limit(1);
    if (existing) {
      roleIds.set(def.slug, existing.id);
      continue;
    }
    const [inserted] = await db
      .insert(roles)
      .values({
        name: def.name,
        slug: def.slug,
        description: def.description,
        permissions: def.permissions,
        isSystem: def.isSystem,
      })
      .returning();
    roleIds.set(def.slug, inserted.id);
  }
  console.log(`Roles ready: ${[...roleIds.keys()].join(", ")}`);

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  if (count > 0) {
    console.log(`${count} user(s) already exist — admin bootstrap skipped.`);
    return;
  }

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  const name = process.env.ADMIN_NAME?.trim() || "Administrator";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || password.length < 8) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (min 8 characters) to create the first Super Admin.");
  }

  const superAdminId = roleIds.get("super_admin");
  if (!superAdminId) throw new Error("super_admin role missing from DEFAULT_ROLE_DEFINITIONS");

  await db.insert(users).values({
    name,
    email,
    passwordHash: hashPassword(password),
    jobTitle: "Administrator",
    department: "Management Service Team",
    roleId: superAdminId,
    availability: "Online",
    isActive: true,
  });
  console.log(`Super Admin created: ${email}`);
}

seed()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
