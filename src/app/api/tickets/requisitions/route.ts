import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/src/server/http";
import { createRequisition, getOperationsData, saveOperationsData } from "@/src/server/operations";

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return unauthorized();

  const params = request.nextUrl.searchParams;
  const search = params.get("search")?.toLowerCase() || "";
  const status = params.get("status") || "";
  const department = params.get("department") || "";
  const priority = params.get("priority") || "";
  const pageSize = Number(params.get("pageSize") || "100");
  const data = await getOperationsData();

  const items = data.requisitions.filter((entry) => {
    const matchesSearch = !search || `${entry.reference} ${entry.title} ${entry.department || ""}`.toLowerCase().includes(search);
    const matchesStatus = !status || entry.status === status;
    const matchesDepartment = !department || entry.department === department;
    const matchesPriority = !priority || entry.priority === priority;
    return matchesSearch && matchesStatus && matchesDepartment && matchesPriority;
  });

  return NextResponse.json({ items: items.slice(0, pageSize) });
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return unauthorized();

  const data = await getOperationsData();
  const body = await request.json();
  const requisition = createRequisition(data, body, user);
  await saveOperationsData(data);
  return NextResponse.json(requisition);
}
