import { NextResponse } from "next/server";
import { getSetting } from "@/src/server/settings";
import { fallbackBranding } from "@/src/server/branding";

const fallbackSite = {
  heroTitle: fallbackBranding.schoolName,
  heroSubtitle: "A connected operations layer for admissions, store, inventory and communication.",
  contactEmail: "admin@popin.school",
  contactPhone: "+27 11 000 0000",
  campusCity: "Johannesburg",
  stats: []
};

export async function GET() {
  const [site, branding] = await Promise.all([
    getSetting("site", fallbackSite),
    getSetting("branding", fallbackBranding)
  ]);

  const schoolName = branding.schoolName || fallbackBranding.schoolName;
  return NextResponse.json({
    ...site,
    heroTitle: !site.heroTitle || site.heroTitle === fallbackBranding.schoolName ? schoolName : site.heroTitle,
    contactEmail: site.contactEmail || branding.email || fallbackSite.contactEmail,
    contactPhone: site.contactPhone || branding.phone || fallbackSite.contactPhone
  });
}
