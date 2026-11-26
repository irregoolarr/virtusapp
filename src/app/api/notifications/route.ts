import { route } from "@/server/http";
import { getNotifications } from "@/server/services/notifications";

/** Notification bell: items are filtered by the modules the user can read. */
export const GET = route(null, async ({ user }) => getNotifications(user));
