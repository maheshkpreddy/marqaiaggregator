import { NextResponse } from "next/server";
import { getSessionToken, revokeSession, clearSessionCookie } from "@/lib/auth";

/**
 * POST /api/auth/logout
 * Revokes the session token and clears the cookie.
 */
export async function POST() {
  const token = await getSessionToken();
  if (token) await revokeSession(token);
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  res.cookies.set("marq_org", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
