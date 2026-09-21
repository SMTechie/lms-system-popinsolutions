import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/src/server/auth";
import { prisma } from "@/src/server/prisma";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const name = String(body.name || "").trim();

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
