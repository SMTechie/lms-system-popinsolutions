type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

type SendEmailResult = {
  ok: boolean;
  skipped?: boolean;
  error?: string;
  id?: string;
};

function normalizeRecipients(to: string | string[]) {
  return (Array.isArray(to) ? to : [to])
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function sendTransactionalEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || process.env.RESEND_FROM || "POPIN LMS <onboarding@resend.dev>";
  const recipients = normalizeRecipients(input.to);

  if (!apiKey || recipients.length === 0) {
    return { ok: false, skipped: true, error: "Resend is not configured." };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: input.replyTo,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { ok: false, error: errorText || "Email delivery failed." };
    }

    const payload = (await response.json()) as { id?: string };
    return { ok: true, id: payload.id };
  } catch (error: any) {
    return { ok: false, error: error?.message || "Email delivery failed." };
  }
}

export function renderWelcomeEmail(name: string, loginUrl: string) {
  return {
    subject: "Welcome to POPIN LMS",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <h2>Welcome${name ? `, ${name}` : ""}</h2>
        <p>Your POPIN LMS account is ready.</p>
        <p>You can sign in here: <a href="${loginUrl}">${loginUrl}</a></p>
        <p>If you were invited as a parent or guardian, learner access appears automatically once your email matches a verified guardian link.</p>
      </div>
    `,
    text: `Welcome${name ? `, ${name}` : ""}. Your POPIN LMS account is ready. Sign in here: ${loginUrl}`,
  };
}

export function renderGuardianLinkedEmail(name: string, learnerName: string, registerUrl: string) {
  return {
    subject: `Guardian access linked for ${learnerName}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <h2>Hello${name ? `, ${name}` : ""}</h2>
        <p>You have been linked as a guardian for <strong>${learnerName}</strong> in POPIN LMS.</p>
        <p>If you already have an account, sign in to the Parent Portal. If not, create one here: <a href="${registerUrl}">${registerUrl}</a></p>
      </div>
    `,
    text: `You have been linked as a guardian for ${learnerName}. Create your account here: ${registerUrl}`,
  };
}

export function renderTeacherWelcomeEmail(name: string, loginUrl: string, temporaryPassword?: string) {
  return {
    subject: "Your teacher account is ready",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <h2>Hello${name ? `, ${name}` : ""}</h2>
        <p>Your teacher account has been created in POPIN LMS.</p>
        ${temporaryPassword ? `<p>Your temporary password is <strong>${temporaryPassword}</strong>.</p>` : ""}
        <p>Sign in here: <a href="${loginUrl}">${loginUrl}</a></p>
      </div>
    `,
    text: `Your teacher account is ready. ${temporaryPassword ? `Temporary password: ${temporaryPassword}. ` : ""}Sign in here: ${loginUrl}`,
  };
}

export function renderDisciplineEmail(input: {
  guardianName?: string;
  learnerName: string;
  incidentTitle: string;
  category: string;
  severity: string;
  actionTaken?: string;
  portalUrl: string;
}) {
  return {
    subject: `Disciplinary update for ${input.learnerName}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <h2>Hello${input.guardianName ? `, ${input.guardianName}` : ""}</h2>
        <p>A disciplinary item has been logged for <strong>${input.learnerName}</strong>.</p>
        <ul>
          <li><strong>Title:</strong> ${input.incidentTitle}</li>
          <li><strong>Category:</strong> ${input.category}</li>
          <li><strong>Severity:</strong> ${input.severity}</li>
          ${input.actionTaken ? `<li><strong>Action taken:</strong> ${input.actionTaken}</li>` : ""}
        </ul>
        <p>You can review it in the Parent Portal: <a href="${input.portalUrl}">${input.portalUrl}</a></p>
      </div>
    `,
    text: `A disciplinary item has been logged for ${input.learnerName}: ${input.incidentTitle} (${input.category}, ${input.severity}). Review it here: ${input.portalUrl}`,
  };
}

export function renderCommunicationCampaignEmail(input: {
  title: string;
  subject: string;
  content: string;
  schoolName?: string;
}) {
  const heading = input.subject || input.title || "School communication";
  const schoolName = input.schoolName || "POPIN School";
  return {
    subject: heading,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
        <p style="font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #2563eb;">${schoolName}</p>
        <h2>${heading}</h2>
        <p>${String(input.content || "").replace(/\n/g, "<br/>")}</p>
      </div>
    `,
    text: `${schoolName}\n\n${heading}\n\n${input.content}`,
  };
}
