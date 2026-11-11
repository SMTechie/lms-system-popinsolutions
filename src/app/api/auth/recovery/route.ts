import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/server/prisma";
import { consumeChallenge, rateLimit, sendChallenge } from "@/src/server/accountSecurity";
import { hashPassword } from "@/src/server/auth";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const email = String(body.email || "").trim().toLowerCase();
  if (!email || !await rateLimit(`recovery:${email}`, 5)) return NextResponse.json({ error: "Please try again later." }, { status: 429 });
  const user = await prisma.user.findUnique({ where: { email } });
  if (body.token) {
    const password = String(body.password || "");
    if (password.length < 12) return NextResponse.json({ error: "Use at least 12 characters for your password." }, { status: 400 });
    if (!user || !await consumeChallenge(user.id, "RESET", String(body.token))) return NextResponse.json({ error: "Invalid or expired reset link." }, { status: 400 });
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } }),
      prisma.authSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return NextResponse.json({ message: "Password updated. Sign in with your new password." });
  }
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: "Account recovery email is not configured. Contact the school office." }, { status: 503 });
  if (user?.registrationStatus === "APPROVED") {
    try { await sendChallenge(user, "RESET"); }
    catch { console.error("Password recovery email delivery failed"); }
  }
  return NextResponse.json({ message: "If this email belongs to an approved account, a reset link will be sent." });
}
