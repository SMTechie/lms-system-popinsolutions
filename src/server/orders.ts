import { prisma } from "./prisma";
import { getOperationsData, saveOperationsData } from "./operations";
import { getPortalData, savePortalData } from "./portalData";
import { appendAuditLog } from "./settings";

export async function transitionOrder(id: string, user: { id: string; role: string; email: string }, status: string, reference?: string) {
  const order = await prisma.storeOrder.findUnique({ where: { id } });
  if (!order || (user.role !== "ADMIN" && order.userId !== user.id)) throw new Error("Order not found.");
  const allowed: Record<string, string[]> = {
    PLACED: ["PAID", "CANCELLED"], PAID: ["PREPARING", "REFUNDED"],
    PREPARING: ["READY_FOR_COLLECTION", "REFUNDED"], READY_FOR_COLLECTION: ["COLLECTED", "REFUNDED"], COLLECTED: ["REFUNDED"],
  };
  if (!(allowed[order.status] || []).includes(status)) throw new Error("This order cannot move to that status.");
  if (user.role !== "ADMIN" && !["CANCELLED", "COLLECTED"].includes(status)) throw new Error("Only the school can perform this action.");
  if (["PAID", "REFUNDED"].includes(status) && !reference?.trim()) throw new Error("Enter the bank or provider transaction reference.");
  if (status === "CANCELLED" || status === "REFUNDED") {
    const data = await getOperationsData();
    for (const line of order.items as Array<{ productId: string; quantity: number }>) {
      const product = data.store.products.find(p => p.id === line.productId);
      if (product) product.stockQuantity = Number(product.stockQuantity || 0) + line.quantity;
    }
    await saveOperationsData(data);
  }
  const updated = await prisma.storeOrder.update({ where: { id }, data: {
    status,
    ...(status === "COLLECTED" ? { collectedAt: new Date() } : {}),
    ...(status === "PAID" ? { paymentStatus: "PAID", paymentReference: reference } : {}),
    ...(status === "REFUNDED" ? { paymentStatus: "REFUNDED", refundReference: reference } : {}),
  } });
  const portal = await getPortalData();
  portal.parent.notifications.unshift({ id: `order-${id}-${status}`, recipientEmail: order.email, recipientRole: "PARENT", title: "Order updated", message: `Your order is ${status.toLowerCase().replaceAll("_", " ")}.`, createdAt: new Date().toISOString(), readAt: null } as any);
  await savePortalData(portal);
  await appendAuditLog({ action: `order.${status.toLowerCase()}`, entity: "StoreOrder", entityId: id, actorId: user.id, metadata: { previousStatus: order.status, reference } });
  return updated;
}
