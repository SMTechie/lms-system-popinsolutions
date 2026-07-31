import { ImageResponse } from "next/og";
import { fallbackBranding, brandingInitials } from "@/src/server/branding";
import { getSetting } from "@/src/server/settings";

export const runtime = "nodejs";

function sanitizeSize(value: string | null) {
  const size = Number(value || 512);
  if (!Number.isFinite(size)) return 512;
  return Math.max(128, Math.min(1024, Math.round(size)));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const size = sanitizeSize(url.searchParams.get("size"));
  const branding = await getSetting("branding", fallbackBranding);
  const schoolName = branding.schoolName || fallbackBranding.schoolName;
  const primaryColor = branding.primaryColor || fallbackBranding.primaryColor;
  const accentColor = url.searchParams.get("accent") || branding.accentColor || fallbackBranding.accentColor;
  const logoUrl = branding.logoUrl;
  const initials = brandingInitials(schoolName);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(160deg, ${primaryColor} 0%, ${accentColor} 100%)`,
          position: "relative",
          color: "white",
          fontFamily: "Arial, sans-serif"
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: size * 0.06,
            borderRadius: size * 0.18,
            border: `${Math.max(4, size * 0.012)}px solid rgba(255,255,255,0.14)`
          }}
        />
        <div
          style={{
            width: size * 0.64,
            height: size * 0.64,
            borderRadius: size * 0.18,
            background: "rgba(255,255,255,0.96)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            boxShadow: "0 18px 45px rgba(15, 23, 42, 0.22)"
          }}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={schoolName}
              style={{
                width: "82%",
                height: "82%",
                objectFit: "contain"
              }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                height: "100%",
                color: primaryColor,
                fontSize: size * 0.2,
                fontWeight: 800,
                letterSpacing: 0
              }}
            >
              {initials}
            </div>
          )}
        </div>
      </div>
    ),
    {
      width: size,
      height: size
    }
  );
}
