import { NextRequest, NextResponse } from "next/server";
import { destroySessionByRawToken, SESSION_COOKIE_NAME, sessionCookieSecure } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  await destroySessionByRawToken(token);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: sessionCookieSecure(),
  });
  return response;
}
