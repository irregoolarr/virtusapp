import { created, parseBody, route } from "@/server/http";
import { createDeal, listPipeline } from "@/server/services/pipeline";
import { pipelineCreateSchema } from "@/shared/schemas";

export const GET = route("pipeline:read", async () => ({ items: await listPipeline() }));

export const POST = route("pipeline:write", async ({ req, user }) => {
  const input = await parseBody(req, pipelineCreateSchema, "Invalid pipeline deal input");
  return created({ item: await createDeal(input, user.id) });
});
