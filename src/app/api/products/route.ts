import { created, parseBody, route } from "@/server/http";
import { createProduct, listProducts } from "@/server/services/products";
import { productCreateSchema } from "@/shared/schemas";

export const GET = route("products:read", async () => ({ items: await listProducts() }));

export const POST = route("products:write", async ({ req }) => {
  const input = await parseBody(req, productCreateSchema, "Invalid product input");
  return created({ item: await createProduct(input) });
});
