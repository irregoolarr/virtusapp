import { created, parseBody, route } from "@/server/http";
import { createCustomer, listCustomers } from "@/server/services/customers";
import { customerCreateSchema } from "@/shared/schemas";

export const GET = route("customers:read", async () => ({ items: await listCustomers() }));

export const POST = route("customers:write", async ({ req, user }) => {
  const input = await parseBody(req, customerCreateSchema, "Invalid customer input");
  return created({ item: await createCustomer(input, user.id) });
});
