import { and, desc, eq } from "drizzle-orm";
import { db, entityComments, users } from "@/db";
import type { AuthenticatedUser } from "@/lib/auth";
import { ApiError, notFound, serialize } from "@/server/http";
import type { CommentItem } from "@/shared/types";
import { commentCreateSchema, commentUpdateSchema } from "@/shared/schemas";
import type { z } from "zod";

export async function listComments(entityType: string, entityId: number): Promise<CommentItem[]> {
  const rows = await db
    .select({
      id: entityComments.id,
      entityType: entityComments.entityType,
      entityId: entityComments.entityId,
      body: entityComments.body,
      createdAt: entityComments.createdAt,
      updatedAt: entityComments.updatedAt,
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

/** Only the author may change their comment. */
async function ownComment(id: number, user: AuthenticatedUser) {
  const [row] = await db.select().from(entityComments).where(eq(entityComments.id, id)).limit(1);
  if (!row) throw notFound("Comment not found");
  if (row.authorId !== user.id) throw new ApiError(403, "You can only edit or delete your own comments");
  return row;
}

export async function updateComment(id: number, d: z.output<typeof commentUpdateSchema>, user: AuthenticatedUser) {
  await ownComment(id, user);
  const [updated] = await db
    .update(entityComments)
    .set({ body: d.body.trim(), updatedAt: new Date() })
    .where(eq(entityComments.id, id))
    .returning();
  return serialize({
    ...updated,
    authorName: user.name,
    authorJobTitle: user.jobTitle,
    authorAvatarColor: user.avatarColor,
  });
}

export async function deleteComment(id: number, user: AuthenticatedUser): Promise<void> {
  await ownComment(id, user);
  await db.delete(entityComments).where(eq(entityComments.id, id));
}
