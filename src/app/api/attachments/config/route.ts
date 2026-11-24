import { route } from "@/server/http";
import { attachmentConfig } from "@/server/services/attachments";

/** Upload limits for the browser (bigger when Google Drive direct upload is available). */
export const GET = route(null, async () => attachmentConfig());
