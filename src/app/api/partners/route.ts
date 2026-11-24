import { created, parseBody, route } from "@/server/http";
import { createPartner, listPartners } from "@/server/services/customers";
import { partnerCreateSchema } from "@/shared/schemas";

export const GET = route("customers:read", async () => ({ items: await listPartners() }));

export const POST = route("customers:write", async ({ req }) => {
  const input = await parseBody(req, partnerCreateSchema, "Invalid business partner input");
  return created({ item: await createPartner(input) });
});
