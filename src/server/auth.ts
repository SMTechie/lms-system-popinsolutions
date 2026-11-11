import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./prisma";
import { getSetting } from "./settings";
import { cookies } from "next/headers";

function authSecret() {
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 16) throw new Error("AUTH_SECRET must contain at least 16 characters.");
  return new TextEncoder().encode(process.env.AUTH_SECRET);
}

export type AuthPayload = {
  sub: string;
  email: string;
  role: string;
  name?: string | null;
  sid?: string;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createAuthToken(payload: AuthPayload) {
  const session = await prisma.authSession.create({ data: { userId: payload.sub, expiresAt: new Date(Date.now() + 12 * 3600000) } });
  return new SignJWT({ ...payload, sid: session.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .setIssuer("popin-lms")
    .setAudience("popin-users")
    .sign(authSecret());
}

export async function verifyAuthToken(token: string) {
  const result = await jwtVerify(token, authSecret(), {
    issuer: "popin-lms",
    audience: "popin-users"
  });

  return result.payload as unknown as AuthPayload;
}

export function getBearerToken(header: string | null) {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim();
}

export async function getCurrentUserFromHeader(header: string | null) {
  const token = getBearerToken(header) || (await cookies()).get("popin_session")?.value;
  if (!token) return null;
  const payload = await verifyAuthToken(token).catch(() => null);
  if (!payload) return null;
  if (!payload.sid) return null;
  const session = await prisma.authSession.findUnique({ where: { id: payload.sid }, include: { user: true } });
  if (!session || session.userId !== payload.sub || session.revokedAt || session.expiresAt <= new Date() || session.user.registrationStatus !== "APPROVED") return null;
  const policy = await getSetting<{ sessionTimeoutMinutes?: number }>("authentication", {});
  const minutes = Math.max(5, Math.min(720, Number(policy.sessionTimeoutMinutes) || 60));
  if (Date.now() - session.lastSeenAt.getTime() > minutes * 60000) return null;
  if (Date.now() - session.lastSeenAt.getTime() > 60000) await prisma.authSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  return session.user;
}

export async function requireCurrentUserFromHeader(header: string | null) {
  const user = await getCurrentUserFromHeader(header);
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}
