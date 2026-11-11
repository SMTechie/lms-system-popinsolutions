import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { AsyncLocalStorage } from "node:async_hooks";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

const client =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = client;
}

const transactions = new AsyncLocalStorage<Prisma.TransactionClient>();
export const inTransaction = () => Boolean(transactions.getStore());
export async function withReadSnapshot<T>(action: () => Promise<T>) {
  if (transactions.getStore()) return action();
  return client.$transaction(tx => transactions.run(tx, action), { isolationLevel: "RepeatableRead", timeout: 15000 });
}
export const prisma = new Proxy(client, {
  get(target, property) {
    const active = transactions.getStore() || target;
    const value = Reflect.get(active, property);
    return typeof value === "function" ? value.bind(active) : value;
  },
});

// A database lock protects legacy aggregate records across processes. All writes
// and their audit records commit together; error responses roll back mutations.
export function withWriteTransaction<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    if (transactions.getStore()) return handler(...args);
    try {
      return await client.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(71842903)`;
        return transactions.run(tx, async () => {
          const response = await handler(...args);
          if (response.status >= 400) throw { response };
          return response;
        });
      }, { maxWait: 15000, timeout: 60000 });
    } catch (error) {
      if (error && typeof error === "object" && "response" in error) return error.response as Response;
      console.error("API transaction failed", error instanceof Error ? error.name : "Unknown error");
      return Response.json({ error: "The request could not be saved. Please try again." }, { status: 500 });
    }
  };
}
