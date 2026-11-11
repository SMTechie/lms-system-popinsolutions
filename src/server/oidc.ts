import { getPortalData } from "./portalData";
import { decryptSecret } from "./secrets";

export async function oidcProvider(name: string) {
  if (process.env.ENABLE_EXTERNAL_IDENTITY !== "true") throw new Error("Use your school email and password to sign in.");
  if (!["microsoft", "google"].includes(name)) throw new Error("This sign-in provider is not enabled.");
  const data = await getPortalData();
  const provider = data.identityProviders.find((item: any) => item.provider === name) as any;
  if (!provider?.clientId || !provider.clientSecret || provider.status === "NOT_CONFIGURED") throw new Error("This sign-in provider is not configured.");
  if (name === "microsoft" && !/^[0-9a-f-]{36}$/i.test(provider.externalTenantId || "")) throw new Error("Configure a specific Microsoft tenant ID.");
  const issuer = name === "google" ? "https://accounts.google.com" : `https://login.microsoftonline.com/${provider.externalTenantId}/v2.0`;
  const response = await fetch(`${issuer}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("Identity provider discovery failed.");
  const discovery = await response.json();
  if (discovery.issuer !== issuer) throw new Error("Identity provider issuer mismatch.");
  return { provider, issuer, discovery, secret: decryptSecret(provider.clientSecret) };
}
