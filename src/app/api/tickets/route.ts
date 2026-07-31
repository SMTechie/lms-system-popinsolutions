import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/src/server/http";
import { getOperationsData, saveOperationsData } from "@/src/server/operations";

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return unauthorized();
  const search = request.nextUrl.searchParams.get("search")?.toLowerCase() || "";
  const data = await getOperationsData();
  const items = data.tickets.filter((ticket) => !search || `${ticket.title} ${ticket.category}`.toLowerCase().includes(search));
  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return unauthorized();
  const body = await request.json();
  const data = await getOperationsData();
  const ticket = {
    id: `TKT-${String(data.tickets.length + 1).padStart(3, "0")}`,
    title: body.title || "New Ticket",
    category: body.category || "General",
    priority: body.priority || "medium",
    assignee: body.assignee || (user.name || user.email),
    status: "open",
    created: new Date().toISOString().slice(0, 10)
  };
  data.tickets.unshift(ticket);
  await saveOperationsData(data);
  return NextResponse.json(ticket);
}
