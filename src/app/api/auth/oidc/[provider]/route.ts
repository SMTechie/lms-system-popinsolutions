import { randomBytes, createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/server/prisma";
import { encryptSecret } from "@/src/server/secrets";
import { oidcProvider } from "@/src/server/oidc";

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  try {
    const name = (await params).provider;
    const { provider, discovery } = await oidcProvider(name);
    const state = randomBytes(32).toString("base64url");
    const nonce = randomBytes(32).toString("base64url");
    const verifier = randomBytes(32).toString("base64url");
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin}/api/auth/oidc/${name}/callback`;
    await prisma.oAuthState.create({ data: { id: state, payload: encryptSecret(JSON.stringify({ name, nonce, verifier, redirectUri })), expiresAt: new Date(Date.now() + 10 * 60000) } });
    const url = new URL(discovery.authorization_endpoint);
    for (const [key, value] of Object.entries({ client_id: provider.clientId, response_type: "code", scope: "openid profile email", redirect_uri: redirectUri, state, nonce, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" })) url.searchParams.set(key, String(value));
    const response = NextResponse.redirect(url);
    response.cookies.set("popin_oidc_state", state, { httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:", path: "/api/auth/oidc", maxAge: 600 });
    return response;
  } catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 503 }); }
}
