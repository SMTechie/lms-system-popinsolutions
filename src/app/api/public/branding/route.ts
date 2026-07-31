import { NextResponse } from "next/server";
import { getSetting } from "@/src/server/settings";
import { fallbackBranding } from "@/src/server/branding";

export async function GET() {
  const branding = await getSetting("branding", fallbackBranding);
  return NextResponse.json(branding);
}
