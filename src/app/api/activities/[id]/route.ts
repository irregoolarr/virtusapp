import { idParam, route } from "@/server/http";
import { deleteActivity, getActivity } from "@/server/services/activities";
import { ENTITY_PERMISSIONS, type EntityType } from "@/server/entities";
import { requirePermission } from "@/server/http";

export const DELETE = route(null, async ({ params, user }) => {
  const id = idParam(params);
  const row = await getActivity(id);
  requirePermission(user, ENTITY_PERMISSIONS[row.entityType as EntityType]?.write ?? "rbac:manage");
  await deleteActivity(id, user);
  return { ok: true };
});
