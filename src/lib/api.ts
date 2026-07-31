const TOKEN_KEY = "popin_access_token";

type RequestOptions = RequestInit & { auth?: boolean };

export const tokenStorage = {
  get(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(TOKEN_KEY);
  },
  set(token: string) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TOKEN_KEY, token);
  },
  clear() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(TOKEN_KEY);
  }
};

export async function apiRequest<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true, headers, body, ...rest } = options;
  const token = auth ? tokenStorage.get() : null;
  const response = await fetch(`/api${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {})
    },
    body
  });

  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  let payload: any = null;
  if (text) {
    if (!contentType.includes("application/json")) {
      throw new Error(`API route /api${path} returned ${contentType || "non-JSON"} instead of JSON.`);
    }
    payload = JSON.parse(text);
  }

  if (!response.ok) {
    throw new Error(payload?.error || `Request failed with status ${response.status}`);
  }

  return payload as T;
}
