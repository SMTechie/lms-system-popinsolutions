import { createHmac } from "node:crypto";
import { getSetting, putSetting } from "./settings";

export async function callMarketing(webhook = false) {
  const config = await getSetting<any>("marketing-integration", {});
  const target = webhook ? config.webhookTargetUrl : new URL(config.catalogEndpoint || "/api/public/site", config.websiteBaseUrl).toString();
  const url = new URL(target);
  const hosts = (process.env.MARKETING_ALLOWED_HOSTS || "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  if (url.protocol !== "https:" || url.username || url.password || !hosts.includes(url.hostname.toLowerCase())) throw new Error("Configure this HTTPS hostname in MARKETING_ALLOWED_HOSTS before connecting.");
  const body = webhook ? JSON.stringify({ type: "connection.test", createdAt: new Date().toISOString() }) : undefined;
  const headers: Record<string, string> = { Accept: "application/json", ...(config.customHeaders || {}) };
  if (config.apiKey) headers["X-API-Key"] = config.apiKey;
  if (body) {
    headers["Content-Type"] = "application/json";
    if (config.requestSigningMode === "hmac") {
      if (!config.webhookSecret) throw new Error("Configure a webhook signing secret.");
      headers["X-Popin-Signature"] = createHmac("sha256", config.webhookSecret).update(body).digest("hex");
    }
  }
  const startedAt = new Date().toISOString();
  let status = 0;
  let error: string | null = null;
  try {
    const response = await fetch(url, { method: webhook ? "POST" : "GET", headers, body, redirect: "error", signal: AbortSignal.timeout(Math.max(1000, Math.min(30000, Number(config.requestTimeoutSeconds || 15) * 1000))) });
    status = response.status;
    await response.body?.cancel();
    if (!response.ok) error = `Remote endpoint returned HTTP ${status}.`;
  } catch { error = "Remote endpoint could not be reached."; }
  const history = await getSetting<any[]>("marketing-connection-history", []);
  const result = { ok: !error, status, error, createdAt: startedAt, type: webhook ? "webhook" : "api" };
  await putSetting("marketing-connection-history", [result, ...history].slice(0, 100));
  return result;
}
