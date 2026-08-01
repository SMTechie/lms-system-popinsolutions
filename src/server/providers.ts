type TwilioChannel = "SMS" | "WHATSAPP";

type TwilioMessageInput = {
  to: string;
  body: string;
  channel: TwilioChannel;
  accountSid?: string;
  authToken?: string;
  fromNumber?: string;
  messagingServiceSid?: string;
  statusCallbackUrl?: string;
};

type ProviderResult = {
  ok: boolean;
  skipped?: boolean;
  id?: string;
  status?: string;
  error?: string;
  raw?: unknown;
};

type PaystackInitializeInput = {
  email: string;
  amount: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
  secretKey?: string;
  currency?: string;
};

type PaystackVerifyInput = {
  reference: string;
  secretKey?: string;
};

function normalizePhone(value: string, channel: TwilioChannel) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (channel === "WHATSAPP") {
    return trimmed.startsWith("whatsapp:") ? trimmed : `whatsapp:${trimmed}`;
  }
  return trimmed.replace(/^whatsapp:/, "");
}

export async function sendTwilioMessage(input: TwilioMessageInput): Promise<ProviderResult> {
  const accountSid = input.accountSid || process.env.TWILIO_ACCOUNT_SID || "";
  const authToken = input.authToken || process.env.TWILIO_AUTH_TOKEN || "";
  const to = normalizePhone(input.to, input.channel);
  const from = normalizePhone(input.fromNumber || process.env.TWILIO_FROM_NUMBER || "", input.channel);
  const messagingServiceSid = input.messagingServiceSid || process.env.TWILIO_MESSAGING_SERVICE_SID || "";

  if (!accountSid || !authToken || !to || (!from && !messagingServiceSid)) {
    return { ok: false, skipped: true, error: `${input.channel} is not fully configured.` };
  }

  try {
    const payload = new URLSearchParams();
    payload.set("To", to);
    payload.set("Body", input.body);
    if (messagingServiceSid) payload.set("MessagingServiceSid", messagingServiceSid);
    else payload.set("From", from);
    if (input.statusCallbackUrl) payload.set("StatusCallback", input.statusCallbackUrl);

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: payload.toString(),
    });

    const json = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        error: json?.message || json?.detail || `Twilio ${input.channel.toLowerCase()} delivery failed.`,
        raw: json,
      };
    }

    return {
      ok: true,
      id: json?.sid,
      status: json?.status,
      raw: json,
    };
  } catch (error: any) {
    return { ok: false, error: error?.message || `Twilio ${input.channel.toLowerCase()} delivery failed.` };
  }
}

export async function initializePaystackTransaction(input: PaystackInitializeInput) {
  const secretKey = input.secretKey || process.env.PAYSTACK_SECRET_KEY || "";
  if (!secretKey) {
    return { ok: false, skipped: true, error: "Paystack is not configured." };
  }

  try {
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: input.email,
        amount: Math.round(Number(input.amount || 0) * 100),
        reference: input.reference,
        callback_url: input.callbackUrl,
        currency: input.currency || "ZAR",
        metadata: input.metadata || {},
      }),
    });

    const json = await response.json().catch(() => null);
    if (!response.ok || !json?.status) {
      return {
        ok: false,
        error: json?.message || "Could not initialize Paystack transaction.",
        raw: json,
      };
    }

    return {
      ok: true,
      authorizationUrl: json.data?.authorization_url as string,
      accessCode: json.data?.access_code as string,
      reference: json.data?.reference as string,
      raw: json,
    };
  } catch (error: any) {
    return { ok: false, error: error?.message || "Could not initialize Paystack transaction." };
  }
}

export async function verifyPaystackTransaction(input: PaystackVerifyInput) {
  const secretKey = input.secretKey || process.env.PAYSTACK_SECRET_KEY || "";
  if (!secretKey) {
    return { ok: false, skipped: true, error: "Paystack is not configured." };
  }

  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(input.reference)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    });

    const json = await response.json().catch(() => null);
    if (!response.ok || !json?.status) {
      return {
        ok: false,
        error: json?.message || "Could not verify Paystack transaction.",
        raw: json,
      };
    }

    return {
      ok: true,
      raw: json,
      data: json.data,
    };
  } catch (error: any) {
    return { ok: false, error: error?.message || "Could not verify Paystack transaction." };
  }
}
