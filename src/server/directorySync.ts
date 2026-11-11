import { randomBytes } from "node:crypto";
import { importPKCS8, SignJWT } from "jose";
import { prisma } from "./prisma";
import { decryptSecret } from "./secrets";
import { hashPassword } from "./auth";

export async function syncDirectory(provider: any) {
  if (process.env.ENABLE_EXTERNAL_IDENTITY !== "true") throw new Error("External identity integration is disabled. Manage school accounts in Settings.");
  let token: string;
  let endpoint: string;
  if (provider.provider === "microsoft") {
    if (!/^[0-9a-f-]{36}$/i.test(provider.externalTenantId || "")) throw new Error("Configure a Microsoft tenant ID.");
    const response = await fetch(`https://login.microsoftonline.com/${provider.externalTenantId}/oauth2/v2.0/token`, { method: "POST", body: new URLSearchParams({ grant_type: "client_credentials", client_id: provider.clientId, client_secret: decryptSecret(provider.clientSecret || ""), scope: "https://graph.microsoft.com/.default" }), signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("Microsoft directory authentication failed. Check credentials and admin consent.");
    token = (await response.json()).access_token;
    endpoint = "https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName,accountEnabled&$top=100";
  } else if (provider.provider === "google") {
    if (!process.env.GOOGLE_DIRECTORY_SERVICE_ACCOUNT_JSON || !process.env.GOOGLE_DIRECTORY_ADMIN) throw new Error("Configure a Google directory service account and delegated administrator.");
    const account = JSON.parse(process.env.GOOGLE_DIRECTORY_SERVICE_ACCOUNT_JSON);
    const key = await importPKCS8(account.private_key, "RS256");
    const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/admin.directory.user.readonly" }).setProtectedHeader({ alg: "RS256" }).setIssuer(account.client_email).setSubject(process.env.GOOGLE_DIRECTORY_ADMIN).setAudience("https://oauth2.googleapis.com/token").setIssuedAt().setExpirationTime("5m").sign(key);
    const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }), signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("Google directory authentication failed. Check domain delegation.");
    token = (await response.json()).access_token;
    endpoint = `https://admin.googleapis.com/admin/directory/v1/users?domain=${encodeURIComponent(provider.tenantDomain)}&maxResults=100`;
  } else throw new Error("Directory sync is available for Microsoft and Google.");
  const directory: Array<{ email: string; name: string; active: boolean }> = [];
  for (let page = 0; endpoint && page < 50; page++) {
    const url = new URL(endpoint);
    if (!["graph.microsoft.com", "admin.googleapis.com"].includes(url.hostname) || url.protocol !== "https:") throw new Error("Invalid directory pagination endpoint.");
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, redirect: "error", signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Directory access failed (HTTP ${response.status}). Check read permissions.`);
    const data = await response.json();
    for (const entry of data.value || data.users || []) directory.push({ email: String(entry.mail || entry.userPrincipalName || entry.primaryEmail || "").toLowerCase(), name: entry.displayName || entry.name?.fullName || "", active: entry.accountEnabled !== false && !entry.suspended });
    endpoint = data["@odata.nextLink"] || (data.nextPageToken ? `https://admin.googleapis.com/admin/directory/v1/users?domain=${encodeURIComponent(provider.tenantDomain)}&maxResults=100&pageToken=${encodeURIComponent(data.nextPageToken)}` : "");
  }
  if (endpoint) throw new Error("Directory exceeds the supported sync size. Narrow its domain scope.");
  let updated = 0; let created = 0;
  for (const entry of directory) {
    if (!entry.email || !entry.active || (provider.tenantDomain && entry.email.split("@")[1] !== provider.tenantDomain.toLowerCase())) continue;
    const existing = await prisma.user.findUnique({ where: { email: entry.email } });
    if (existing?.role === "TEACHER") { await prisma.user.update({ where: { id: existing.id }, data: { name: entry.name } }); updated++; }
    else if (!existing && provider.settings?.autoCreateTeachers) {
      await prisma.user.create({ data: { email: entry.email, name: entry.name, role: "TEACHER", registrationStatus: "PENDING", passwordHash: await hashPassword(randomBytes(32).toString("hex")) } }); created++;
    }
  }
  return { status: "COMPLETED", read: directory.length, updated, created };
}
