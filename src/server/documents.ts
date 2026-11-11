import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";

export async function storeDocument(ownerId: string, input: { name: string; mimeType: string; contentBase64: string }) {
  const encoded = String(input.contentBase64 || "").replace(/^data:[^;]+;base64,/, "");
  if (encoded.length > 7 * 1024 * 1024 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new Error("Invalid file or file exceeds 5 MB.");
  const content = Buffer.from(encoded, "base64");
  if (!content.length || content.length > 5 * 1024 * 1024) throw new Error("Files must be between 1 byte and 5 MB.");
  const mimeType = content.subarray(0, 5).toString() === "%PDF-" ? "application/pdf" : content.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? "image/png" : content[0] === 255 && content[1] === 216 && content[2] === 255 ? "image/jpeg" : null;
  if (!mimeType) throw new Error("Only PDF, PNG and JPEG files are accepted.");
  return prisma.document.create({ data: { ownerId, name: String(input.name || "document").replace(/[^\w. -]/g, "_").slice(0, 150), mimeType, size: content.length, storageKey: randomUUID(), content }, select: { id: true, name: true, mimeType: true, size: true } });
}
