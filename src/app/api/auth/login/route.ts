import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { ApiError } from "@/server/http";
import { signIn } from "@/server/services/auth";
import { loginSchema } from "@/shared/schemas";

// Public endpoint (no session yet), so it doesn't use the `route()` guard.
export async function POST(req: NextRequest) {
  const parsed = loginSchema.safeParse(await req.json().catch(() => undefined));
  if (!parsed.success) {
    return NextResponse.json({ error: "Valid email and password are required" }, { status: 400 });
  }
  try {
    const { user, session } = await signIn(parsed.data.email, parsed.data.password);
    const response = NextResponse.json({ user });
    response.cookies.set(SESSION_COOKIE_NAME, session.rawToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      expires: session.expiresAt,
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch (err) {
    if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("Login failed", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
