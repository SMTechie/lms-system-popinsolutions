import { withWriteTransaction } from "@/src/server/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromHeader } from "@/src/server/auth";
import { appendAuditLog, getSetting, putSetting } from "@/src/server/settings";
import { fallbackBranding } from "@/src/server/branding";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;

  if (key === "branding") {
    const branding = await getSetting("branding", {});
    return NextResponse.json(branding);
  }

  const user = await getCurrentUserFromHeader(request.headers.get("authorization"));
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (key === "site" && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only administrators can maintain the public website." }, { status: 403 });
  }

  const value = await getSetting(key, null);
  return NextResponse.json(value ?? {});
}

async function PUTHandler(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const user = await getCurrentUserFromHeader(request.headers.get("authorization"));
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  if (["portal-data", "operations", "worker-health"].includes(key)) return NextResponse.json({ error: "Use the appropriate workflow to change school records." }, { status: 403 });
  if (key === "authentication") {
    if (payload.mfaRequired && !process.env.RESEND_API_KEY) return NextResponse.json({ error: "Configure and verify email delivery before requiring staff sign-in codes." }, { status: 400 });
    if (!Number.isFinite(Number(payload.sessionTimeoutMinutes)) || Number(payload.sessionTimeoutMinutes) < 5 || Number(payload.sessionTimeoutMinutes) > 720) return NextResponse.json({ error: "Session timeout must be between 5 and 720 minutes." }, { status: 400 });
  }
  const setting = await putSetting(key, payload);
  const schoolName =
    key === "branding" ? payload.schoolName :
    key === "school-profile" ? payload.schoolName :
    undefined;
  const logoUrl = key === "branding" || key === "school-profile" ? payload.logoUrl : undefined;

  if ((typeof schoolName === "string" && schoolName.trim()) || typeof logoUrl === "string") {
    const [branding, schoolProfile, site] = await Promise.all([
      getSetting("branding", fallbackBranding),
      getSetting("school-profile", {} as Record<string, unknown>),
      getSetting("site", {} as Record<string, unknown>)
    ]);

    const nextSchoolName = typeof schoolName === "string" ? schoolName.trim() : undefined;
    await Promise.all([
      putSetting("branding", {
        ...branding,
        ...(key === "branding" ? payload : {}),
        ...(key === "school-profile" && typeof logoUrl === "string" ? { logoUrl } : {}),
        ...(nextSchoolName ? { schoolName: nextSchoolName } : {})
      }),
      putSetting("school-profile", {
        ...schoolProfile,
        ...(key === "school-profile" ? payload : {}),
        ...(nextSchoolName ? { schoolName: nextSchoolName } : {})
      }),
      putSetting("site", {
        ...site,
        ...(nextSchoolName ? { heroTitle: nextSchoolName } : {})
      })
    ]);
  }

  await appendAuditLog({
    action: "UPSERT",
    entity: "Setting",
    entityId: key,
    actorId: user.email,
    metadata: { key }
  });

  return NextResponse.json(setting.value);
}

export const PUT = withWriteTransaction(PUTHandler);
