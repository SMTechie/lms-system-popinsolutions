import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromHeader } from "@/src/server/auth";
import { getSetting } from "@/src/server/settings";

export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromHeader(request.headers.get("authorization"));
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const history = await getSetting<any[]>("marketing-connection-history", []);

  return NextResponse.json({
    lastApi: history.find(item => item.type === "api") || null,
    lastWebhook: history.find(item => item.type === "webhook") || null,
    webhookFailureCount: history.filter(item => item.type === "webhook" && !item.ok).length
  });
}
