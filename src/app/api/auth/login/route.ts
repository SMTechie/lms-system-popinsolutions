import { consumeChallenge, rateLimit, sendChallenge } from "@/src/server/accountSecurity";
import { getSetting } from "@/src/server/settings";
import { NextRequest, NextResponse } from "next/server";
import { createAuthToken, verifyPassword } from "@/src/server/auth";
import { prisma } from "@/src/server/prisma";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!await rateLimit(`login:${email}`, 15)) return NextResponse.json({ error: "Too many sign-in attempts. Try again in 15 minutes." }, { status: 429 });

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  if (user.registrationStatus === "PENDING") {
    return NextResponse.json({ error: "Your registration is awaiting administrator approval." }, { status: 403 });
  }
  if (user.registrationStatus === "REJECTED") {
    return NextResponse.json({ error: user.registrationRejectionReason || "Your registration was rejected. Please contact the school office." }, { status: 403 });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const policy = await getSetting<{ mfaRequired?: boolean }>("authentication", {});
  if (policy.mfaRequired && ["ADMIN", "TEACHER"].includes(user.role)) {
    if (!body.code) {
      try { await sendChallenge(user, "MFA"); }
      catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 503 }); }
      return NextResponse.json({ mfaRequired: true, message: "Enter the code sent to your email." });
    }
    if (!await consumeChallenge(user.id, "MFA", String(body.code))) return NextResponse.json({ error: "Invalid or expired sign-in code." }, { status: 401 });
  }
  const token = await createAuthToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name
  });

  const response = NextResponse.json({
    token: "cookie",
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  });
  response.cookies.set("popin_session", token, { httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production", maxAge: 43200, path: "/" });
  return response;
}

