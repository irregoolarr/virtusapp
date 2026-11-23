import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, entityComments, users } from "@/db";
import { requireApiAuth } from "@/lib/auth";

const createCommentSchema = z.object({
  entityType: z.enum(["corrective", "preventive", "implementation", "poc", "pipeline", "customer"]),
  entityId: z.number().int().positive(),
  body: z.string().min(1).max(2000),
});

export async function GET(req: NextRequest) {
  const auth = await requireApiAuth();
  if ("error" in auth) return auth.error;

  const entityType = req.nextUrl.searchParams.get("entityType");
  const entityId = Number(req.nextUrl.searchParams.get("entityId"));
  if (!entityType || !Number.isInteger(entityId) || entityId <= 0) {
    return NextResponse.json({ error: "entityType and valid entityId required" }, { status: 400 });
  }

  const rows = await db
    .select({
      id: entityComments.id,
      entityType: entityComments.entityType,
      entityId: entityComments.entityId,
      body: entityComments.body,
      createdAt: entityComments.createdAt,
      authorId: entityComments.authorId,
      authorName: users.name,
      authorJobTitle: users.jobTitle,
      authorAvatarColor: users.avatarColor,
    })
    .from(entityComments)
    .leftJoin(users, eq(entityComments.authorId, users.id))
    .where(and(eq(entityComments.entityType, entityType), eq(entityComments.entityId, entityId)))
    .orderBy(desc(entityComments.createdAt));

  return NextResponse.json({ comments: rows });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiAuth();
  if ("error" in auth) return auth.error;

  const parsed = createCommentSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid comment payload" }, { status: 400 });
  }

  const [created] = await db
    .insert(entityComments)
    .values({
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      authorId: auth.user.id,
      body: parsed.data.body.trim(),
    })
    .returning();

  return NextResponse.json(
    {
      comment: {
        ...created,
        authorName: auth.user.name,
        authorJobTitle: auth.user.jobTitle,
        authorAvatarColor: auth.user.avatarColor,
      },
    },
    { status: 201 }
  );
}
