import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/src/server/http";
import { getOperationsData, saveOperationsData } from "@/src/server/operations";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const body = await request.json();
  const data = await getOperationsData();
  const req = data.requisitions.find((entry) => entry.id === id);
  if (!req) return NextResponse.json({ error: "Requisition not found" }, { status: 404 });

  req.status = "APPROVED";
  req.requisition.procurementStatus = "APPROVED";
  req.approvals.unshift({
    id: randomUUID(),
    approvalRole: body.approvalRole || "Approver",
    decision: "APPROVED",
    comments: body.comments || undefined,
    decidedAt: new Date().toISOString(),
    approver: { name: user.name, email: user.email }
  });
  await saveOperationsData(data);
  return NextResponse.json(req);
}
