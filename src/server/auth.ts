import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./prisma";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "change-me");

export type AuthPayload = {
  sub: string;
  email: string;
  role: string;
  name?: string | null;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createAuthToken(payload: AuthPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .setIssuer("popin-lms")
    .setAudience("popin-users")
    .sign(secret);
}

export async function verifyAuthToken(token: string) {
  const result = await jwtVerify(token, secret, {
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
  const token = getBearerToken(header);
  if (!token) return null;
  const payload = await verifyAuthToken(token);
  return prisma.user.findUnique({
    where: { id: payload.sub }
  });
}

export async function requireCurrentUserFromHeader(header: string | null) {
  const user = await getCurrentUserFromHeader(header);
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}
