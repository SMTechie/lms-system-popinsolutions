import { NextRequest, NextResponse } from "next/server";
import { createAuthToken, hashPassword } from "@/src/server/auth";
import { renderWelcomeEmail, sendTransactionalEmail } from "@/src/server/email";
import { prisma } from "@/src/server/prisma";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const name = String(body.name || "").trim();
  const loginUrl = String(body.loginUrl || "").trim() || `${request.nextUrl.origin}/login`;

  if (!email || !password || !name) {
    return NextResponse.json({ error: "Name, email and password are required." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters long." }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      email,
      name,
      role: "PARENT",
      passwordHash: await hashPassword(password)
    }
  });

  const welcomeEmail = renderWelcomeEmail(name, loginUrl);
  await sendTransactionalEmail({
    to: email,
    subject: welcomeEmail.subject,
    html: welcomeEmail.html,
    text: welcomeEmail.text,
  });

  const token = await createAuthToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name
  });

  return NextResponse.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  });
}
