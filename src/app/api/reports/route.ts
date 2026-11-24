import { NextResponse } from "next/server";
import { hasPermission } from "@/lib/rbac";
import { ApiError, parseBody, route } from "@/server/http";
import { buildReportCsv, emailReportDigest, getReportSummary } from "@/server/services/reports";
import { reportEmailSchema } from "@/shared/schemas";

/** JSON summary, or `?format=csv&scope=...` for a CSV download (needs reports:export). */
export const GET = route("reports:read", async ({ req, user }) => {
  if (req.nextUrl.searchParams.get("format") !== "csv") return getReportSummary();

  if (!hasPermission(user.permissions, "reports:export")) {
    throw new ApiError(403, "Missing permission: reports:export");
  }
  const scope = req.nextUrl.searchParams.get("scope") ?? "all";
  return new NextResponse(await buildReportCsv(scope), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="virtusms-${scope}-report.csv"`,
    },
  });
});

export const POST = route("reports:export", async ({ req, user }) => {
  const input = await parseBody(req, reportEmailSchema, "Provide at least one valid recipient email");
  return { dispatch: await emailReportDigest(input, user) };
});
