import { idParam, route } from "@/server/http";
import { restoreFromRecycleBin } from "@/server/services/recycleBin";

/** Restore with the original id and code (needs the module's delete permission). */
export const POST = route(null, async ({ params, user }) => restoreFromRecycleBin(user, idParam(params)));
