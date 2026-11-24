import { route } from "@/server/http";
import { getUsdIdrRate } from "@/server/services/exchangeRate";

/** USD/IDR reference rate for the dashboard (information only). */
export const GET = route("dashboard:read", async () => ({ rate: await getUsdIdrRate() }));
