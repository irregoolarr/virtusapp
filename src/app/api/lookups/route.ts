import { route } from "@/server/http";
import { getLookups } from "@/server/services/lookups";

export const GET = route(null, async () => getLookups());
