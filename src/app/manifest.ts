import type { MetadataRoute } from "next";
import { fallbackBranding } from "@/src/server/branding";
import { getSetting } from "@/src/server/settings";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const branding = await getSetting("branding", fallbackBranding).catch(() => fallbackBranding);
  const schoolName = branding.schoolName || fallbackBranding.schoolName;
  const primaryColor = branding.primaryColor || fallbackBranding.primaryColor;
  const accentColor = branding.accentColor || fallbackBranding.accentColor;

  return {
    name: schoolName,
    short_name: schoolName.length > 12 ? schoolName.slice(0, 12) : schoolName,
    description: `${schoolName} school operations workspace`,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: primaryColor,
    icons: [
      {
        src: `/api/pwa/icon?size=192&accent=${encodeURIComponent(accentColor)}`,
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable"
      },
      {
        src: `/api/pwa/icon?size=512&accent=${encodeURIComponent(accentColor)}`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}
