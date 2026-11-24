// HTTP plumbing for API route handlers: auth + permission guard, input parsing,
// and mapping service errors to JSON responses. Route files stay thin.
import { NextRequest, NextResponse } from "next/server";
import type { ZodType, ZodTypeDef } from "zod";
import { AuthenticatedUser, requireApiAuth } from "@/lib/auth";
import type { PermissionKey } from "@/lib/rbac";
import type { Wire } from "@/shared/types";

/** Error thrown by services; turned into `{ error, details }` with its status. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new ApiError(400, message, details);
export const notFound = (message = "Record not found") => new ApiError(404, message);

interface HandlerArgs {
  req: NextRequest;
  user: AuthenticatedUser;
  params: Record<string, string>;
}

type RouteContext = { params: Promise<Record<string, string>> };

/**
 * Wrap a handler with authentication and an optional permission check.
 * Return a plain object to send it as JSON (200), or a Response for full control.
 */
export function route(permission: PermissionKey | null, handler: (args: HandlerArgs) => Promise<unknown>) {
  return async (req: NextRequest, context: RouteContext): Promise<Response> => {
    const auth = await requireApiAuth(permission ?? undefined);
    if ("error" in auth) return auth.error;
    try {
      const result = await handler({ req, user: auth.user, params: (await context?.params) ?? {} });
      return result instanceof Response ? result : NextResponse.json(result);
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json({ error: err.message, details: err.details }, { status: err.status });
      }
      throw err;
    }
  };
}

/** Parse and validate the JSON body, throwing a 400 ApiError on failure. */
export async function parseBody<Out, In = Out>(
  req: NextRequest,
  schema: ZodType<Out, ZodTypeDef, In>,
  message?: string
): Promise<Out> {
  const body = await req.json().catch(() => undefined);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    // Without an explicit message, surface the first validation message (e.g. "too short").
    throw badRequest(message ?? parsed.error.issues[0]?.message ?? "Invalid request body", parsed.error.flatten());
  }
  return parsed.data;
}

/** Read a positive integer `[id]` route param, or throw 400. */
export function idParam(params: Record<string, string>): number {
  const n = Number(params.id);
  if (!Number.isInteger(n) || n <= 0) throw badRequest("Invalid ID");
  return n;
}

export const created = (body: unknown) => NextResponse.json(body, { status: 201 });

/** Convert Date fields to ISO strings so values match their `Wire<T>` API type. */
export function serialize<T>(value: T): Wire<T> {
  if (value instanceof Date) return value.toISOString() as Wire<T>;
  if (Array.isArray(value)) return value.map(serialize) as Wire<T>;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = serialize(v);
    return out as Wire<T>;
  }
  return value as Wire<T>;
}

/** Copy only the keys that are present (not undefined) in a partial update. */
export function definedFields<T extends object, K extends keyof T>(source: T, keys: readonly K[]): Partial<Pick<T, K>> {
  const out: Partial<Pick<T, K>> = {};
  for (const k of keys) if (source[k] !== undefined) out[k] = source[k];
  return out;
}
