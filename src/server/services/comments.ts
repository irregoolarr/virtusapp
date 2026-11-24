import { and, desc, eq } from "drizzle-orm";
import { db, entityComments, users } from "@/db";
import type { AuthenticatedUser } from "@/lib/auth";
import { serialize } from "@/server/http";
import type { CommentItem } from "@/shared/types";
import { commentCreateSchema } from "@/shared/schemas";
import type { z } from "zod";

export async function listComments(entityType: string, entityId: number): Promise<CommentItem[]> {
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
  return rows.map(serialize);
}

export async function addComment(d: z.output<typeof commentCreateSchema>, author: AuthenticatedUser) {
  const [created] = await db
    .insert(entityComments)
    .values({ entityType: d.entityType, entityId: d.entityId, authorId: author.id, body: d.body.trim() })
    .returning();
  return serialize({
    ...created,
    authorName: author.name,
    authorJobTitle: author.jobTitle,
    authorAvatarColor: author.avatarColor,
  });
}
