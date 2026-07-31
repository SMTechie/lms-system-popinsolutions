import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/src/server/http";
import { computeRequisitionOverview, getOperationsData } from "@/src/server/operations";

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return unauthorized();

  return NextResponse.json(computeRequisitionOverview(await getOperationsData()));
}
