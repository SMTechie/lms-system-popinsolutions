import { NextRequest, NextResponse } from "next/server";

/**
 * Applies the API-wide request safeguards before a Vercel Function runs.
 * Next.js 16 uses the `proxy` convention in place of `middleware`.
 */
export function proxy(request: NextRequest) {
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    const expected = process.env.NEXT_PUBLIC_APP_URL
      ? new URL(process.env.NEXT_PUBLIC_APP_URL).origin
      : request.nextUrl.origin;
    if (
      (origin && origin !== expected && origin !== request.nextUrl.origin) ||
      (!origin && request.cookies.has("popin_session") && !request.headers.has("authorization"))
    ) {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
    if (Number(request.headers.get("content-length") || 0) > 55 * 1024 * 1024) {
      return NextResponse.json({ error: "Request exceeds the upload limit." }, { status: 413 });
    }
  }

  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}

export const config = { matcher: "/api/:path*" };
