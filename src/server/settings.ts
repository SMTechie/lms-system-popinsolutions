import { prisma } from "./prisma";

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const setting = await prisma.setting.findUnique({ where: { key } });
  return (setting?.value as T | undefined) ?? fallback;
}

export async function putSetting<T>(key: string, value: T) {
  return prisma.setting.upsert({
    where: { key },
    update: { value: value as any },
    create: { key, value: value as any }
  });
}

export async function appendAuditLog(input: {
  action: string;
  entity: string;
  entityId: string;
  actorId?: string | null;
  metadata?: unknown;
}) {
  return prisma.auditLog.create({
    data: {
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      actorId: input.actorId ?? undefined,
      metadata: input.metadata as any
    }
  });
}
