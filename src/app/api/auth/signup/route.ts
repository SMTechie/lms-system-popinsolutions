import { withWriteTransaction } from "@/src/server/prisma";
import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/src/server/auth";
import { prisma } from "@/src/server/prisma";
import { rateLimit } from "@/src/server/accountSecurity";

async function POSTHandler(request: NextRequest) {
  const body = await request.json();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const name = String(body.name || "").trim();

  if (!email || !password || !name) {
    return NextResponse.json({ error: "Name, email and password are required." }, { status: 400 });
  }

  if (password.length < 12 || password.length > 128) {
    return NextResponse.json({ error: "Use a password of 12 to 128 characters." }, { status: 400 });
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
      passwordHash: await hashPassword(password),
      registrationStatus: "PENDING"
    }
  });

  return NextResponse.json({
    pending: true,
    message: "Registration submitted. An administrator must approve your account before you can sign in.",
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  });
}

const saveSignup = withWriteTransaction(POSTHandler);
export async function POST(request: NextRequest) {
  if (!await rateLimit(`signup:${request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"}`, 10, 60)) return NextResponse.json({ error: "Too many registrations. Please try again later." }, { status: 429 });
  return saveSignup(request);
}
