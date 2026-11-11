import { createHash } from "node:crypto";
import { prisma, withReadSnapshot, inTransaction } from "./prisma";
import { getSetting, putSetting } from "./settings";

type RecordRow = { collection: string; id: string; position: number; payload: any; digest: string; learnerId: string | null; ownerEmail: string | null };

export async function readRecordData<T>(namespace: string, fallback: T): Promise<T> {
  return withReadSnapshot(() => readSnapshot(namespace, fallback));
}

async function readSnapshot<T>(namespace: string, fallback: T): Promise<T> {
  const stored = await getSetting<any>(namespace, fallback);
  if (stored?.__recordStorage !== 1) return stored as T;
  const rows = await prisma.dataRecord.findMany({ where: { namespace }, orderBy: { position: "asc" } });
  const collections = new Map<string, any[]>();
  for (const row of rows) collections.set(row.collection, [...(collections.get(row.collection) || []), row.payload]);
  function hydrate(node: any): any {
    if (!node || typeof node !== "object") return node;
    if (!Array.isArray(node) && typeof node.__collection === "string" && Object.keys(node).length === 1) return collections.get(node.__collection) || [];
    if (Array.isArray(node)) return node.map(hydrate);
    return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, hydrate(value)]));
  }
  return hydrate(stored.root) as T;
}

export async function writeRecordData<T>(namespace: string, data: T) {
  if (!inTransaction()) throw new Error("Record updates require a database transaction.");
  const records: RecordRow[] = [];
  function dehydrate(node: any, path: string[]): any {
    if (!node || typeof node !== "object") return node;
    if (Array.isArray(node)) {
      if (node.length && node.every(item => item && typeof item === "object" && typeof item.id === "string")) {
        const collection = JSON.stringify(path);
        const seen = new Set<string>();
        node.forEach((payload, position) => {
          if (seen.has(payload.id)) throw new Error("Duplicate record IDs cannot be saved.");
          seen.add(payload.id);
          const clean = JSON.parse(JSON.stringify(payload));
          records.push({ collection, id: payload.id, position, payload: clean, digest: createHash("sha256").update(JSON.stringify(clean)).digest("hex"), learnerId: payload.learnerId || null, ownerEmail: payload.parentEmail || payload.recipientEmail || payload.teacherEmail || null });
        });
        return { __collection: collection };
      }
      return node;
    }
    return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, dehydrate(value, [...path, key])]));
  }
  const root = dehydrate(data, []);
  const existing = await prisma.dataRecord.findMany({ where: { namespace }, select: { collection: true, id: true, digest: true, position: true } });
  const key = (row: { collection: string; id: string }) => JSON.stringify([row.collection, row.id]);
  const previous = new Map(existing.map(row => [key(row), row]));
  const retained = new Set(records.map(key));
  for (const row of records) {
    const before = previous.get(key(row));
    if (before?.digest === row.digest && before.position === row.position) continue;
    await prisma.dataRecord.upsert({ where: { namespace_collection_id: { namespace, collection: row.collection, id: row.id } }, create: { namespace, ...row }, update: row });
  }
  for (const row of existing) if (!retained.has(key(row))) await prisma.dataRecord.delete({ where: { namespace_collection_id: { namespace, collection: row.collection, id: row.id } } });
  await putSetting(namespace, { __recordStorage: 1, root });
  return data;
}
