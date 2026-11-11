import { createHash, randomBytes, randomInt } from "node:crypto";
import { prisma } from "./prisma";
import { sendTransactionalEmail } from "./email";

export const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export async function rateLimit(key: string, limit = 10, minutes = 15) {
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt") VALUES (${digest(key)}, 1, ${new Date(Date.now() + minutes * 60000)})
    ON CONFLICT ("key") DO UPDATE SET "count" = CASE WHEN "RateLimit"."resetAt" < NOW() THEN 1 ELSE "RateLimit"."count" + 1 END,
    "resetAt" = CASE WHEN "RateLimit"."resetAt" < NOW() THEN EXCLUDED."resetAt" ELSE "RateLimit"."resetAt" END RETURNING "count"`;
  return rows[0].count <= limit;
}

export async function sendChallenge(user: { id: string; email: string }, purpose: "MFA" | "RESET") {
  const token = purpose === "MFA" ? String(randomInt(100000, 1000000)) : randomBytes(32).toString("hex");
  await prisma.authChallenge.updateMany({ where: { userId: user.id, purpose, consumedAt: null }, data: { consumedAt: new Date() } });
  const challenge = await prisma.authChallenge.create({ data: { userId: user.id, purpose, tokenHash: digest(`${user.id}:${purpose}:${token}`), expiresAt: new Date(Date.now() + (purpose === "MFA" ? 10 : 30) * 60000) } });
  const origin = process.env.NEXT_PUBLIC_APP_URL;
  if (purpose === "RESET" && !origin) throw new Error("The school application URL is not configured.");
  const value = purpose === "MFA" ? `Your sign-in code is ${token}. It expires in 10 minutes.` : `Reset your password: ${origin}/login?reset=${encodeURIComponent(token)}&email=${encodeURIComponent(user.email)}`;
  const result = await sendTransactionalEmail({ to: user.email, subject: purpose === "MFA" ? "Your school sign-in code" : "Reset your school password", html: `<p>${value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</p>`, text: value });
  if (!result.ok) {
    await prisma.authChallenge.delete({ where: { id: challenge.id } });
    throw new Error("Email delivery is unavailable. Please contact the school administrator.");
  }
}

export async function consumeChallenge(userId: string, purpose: string, token: string) {
  const result = await prisma.authChallenge.updateMany({ where: { userId, purpose, tokenHash: digest(`${userId}:${purpose}:${token}`), consumedAt: null, expiresAt: { gt: new Date() } }, data: { consumedAt: new Date() } });
  return result.count === 1;
}
