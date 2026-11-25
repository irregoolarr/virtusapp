import { created, parseBody, route } from "@/server/http";
import { runScheduledChecksQuietly } from "@/server/services/monitoring";
import { createImplementation, listImplementations } from "@/server/services/implementations";
import { implementationCreateSchema } from "@/shared/schemas";

export const GET = route("delivery:read", async () => {
  await runScheduledChecksQuietly();
  return { items: await listImplementations() };
});

export const POST = route("delivery:write", async ({ req, user }) => {
  const input = await parseBody(req, implementationCreateSchema, "Invalid implementation payload");
  return created({ item: await createImplementation(input, user.id) });
});
