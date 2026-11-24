import { route } from "@/server/http";
import { getDashboard } from "@/server/services/dashboard";

export const GET = route("dashboard:read", async () => getDashboard());
