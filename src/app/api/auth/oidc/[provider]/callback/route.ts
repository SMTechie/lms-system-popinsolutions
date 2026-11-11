import { createRemoteJWKSet, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/server/prisma";
import { decryptSecret } from "@/src/server/secrets";
import { oidcProvider } from "@/src/server/oidc";
import { createAuthToken } from "@/src/server/auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  try {
    const name = (await params).provider;
    const state = request.nextUrl.searchParams.get("state");
    if (!state || state !== request.cookies.get("popin_oidc_state")?.value) throw new Error("Invalid sign-in state. Start again.");
    const saved = await prisma.oAuthState.delete({ where: { id: state } });
    if (saved.expiresAt < new Date()) throw new Error("Sign-in expired. Start again.");
    const context = JSON.parse(decryptSecret(saved.payload));
    if (context.name !== name) throw new Error("Provider mismatch.");
    const { provider, discovery, issuer, secret } = await oidcProvider(name);
    const tokenResponse = await fetch(discovery.token_endpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code: request.nextUrl.searchParams.get("code") || "", redirect_uri: context.redirectUri, client_id: provider.clientId, client_secret: secret, code_verifier: context.verifier }), signal: AbortSignal.timeout(15000) });
    if (!tokenResponse.ok) throw new Error("Identity provider rejected sign-in.");
    const tokens = await tokenResponse.json();
    const { payload } = await jwtVerify(tokens.id_token, createRemoteJWKSet(new URL(discovery.jwks_uri)), { issuer, audience: provider.clientId, algorithms: ["RS256"] });
    if (payload.nonce !== context.nonce || !payload.sub) throw new Error("Invalid identity response.");
    const email = String(payload.email || payload.preferred_username || "").toLowerCase();
    if (name === "google" && payload.email_verified !== true) throw new Error("Your provider email is not verified.");
    if (provider.tenantDomain && email.split("@")[1] !== provider.tenantDomain.toLowerCase()) throw new Error("This email domain is not permitted.");
    const identity = await prisma.externalIdentity.findUnique({ where: { issuer_subject: { issuer, subject: payload.sub } } });
    const user = identity ? await prisma.user.findUnique({ where: { id: identity.userId } }) : await prisma.user.findUnique({ where: { email } });
    if (!user || user.registrationStatus !== "APPROVED") throw new Error("Ask the school to provision and approve your account first.");
    if (!(provider.settings?.allowedPortals || ["admin", "teacher", "parent"]).includes(user.role.toLowerCase())) throw new Error("This portal is not enabled for this provider.");
    if (!identity) await prisma.externalIdentity.create({ data: { issuer, subject: payload.sub, userId: user.id } });
    const token = await createAuthToken({ sub: user.id, email: user.email, role: user.role, name: user.name });
    const response = NextResponse.redirect(new URL('/login?sso=complete', process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin));
    response.cookies.set("popin_session", token, { httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", path: "/", maxAge: 43200 });
    response.cookies.delete("popin_oidc_state");
    return response;
  } catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 401 }); }
}
