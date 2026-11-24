import { idParam, parseBody, route } from "@/server/http";
import { deleteProduct, updateProduct } from "@/server/services/products";
import { productCreateSchema } from "@/shared/schemas";

export const PATCH = route("products:write", async ({ req, params }) => {
  const input = await parseBody(req, productCreateSchema.partial(), "Invalid product update");
  return { item: await updateProduct(idParam(params), input) };
});

export const DELETE = route("products:delete", async ({ params }) => {
  await deleteProduct(idParam(params));
  return { ok: true };
});
