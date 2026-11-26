import { route } from "@/server/http";
import { listRecycleBin } from "@/server/services/recycleBin";

/** Deleted records for the modules the user may delete in. */
export const GET = route(null, async ({ user }) => listRecycleBin(user));
