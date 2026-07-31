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
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const value = await getSetting(key, null);
  return NextResponse.json(value ?? {});
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const user = await getCurrentUserFromHeader(request.headers.get("authorization"));
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const setting = await putSetting(key, payload);
  const schoolName =
    key === "branding" ? payload.schoolName :
    key === "school-profile" ? payload.schoolName :
    undefined;

  if (typeof schoolName === "string" && schoolName.trim()) {
    const [branding, schoolProfile, site] = await Promise.all([
      getSetting("branding", fallbackBranding),
      getSetting("school-profile", {} as Record<string, unknown>),
      getSetting("site", {} as Record<string, unknown>)
    ]);

    const nextSchoolName = schoolName.trim();
    await Promise.all([
      putSetting("branding", {
        ...branding,
        ...(key === "branding" ? payload : {}),
        schoolName: nextSchoolName
      }),
      putSetting("school-profile", {
        ...schoolProfile,
        ...(key === "school-profile" ? payload : {}),
        schoolName: nextSchoolName
      }),
      putSetting("site", {
        ...site,
        heroTitle: nextSchoolName
      })
    ]);
  }

  await appendAuditLog({
    action: "UPSERT",
    entity: "Setting",
    entityId: key,
    actorId: user.email,
    metadata: payload
  });

  return NextResponse.json(setting.value);
}
