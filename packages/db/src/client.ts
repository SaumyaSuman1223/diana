import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createDb(url: string, options: { max?: number } = {}) {
  // prepare: false keeps us compatible with Supabase's transaction-mode pooler.
  const client = postgres(url, { max: options.max ?? 10, prepare: false });
  const db: Db = drizzle(client, { schema });
  return { db, close: () => client.end() };
}

/**
 * Run `fn` in a transaction as `userId` with RLS enforced (ADR-005).
 *
 * The caller is responsible for having authenticated `userId` (verified Supabase
 * session, linked Telegram chat, ...). Everything inside runs as the
 * `authenticated` role, so policies apply exactly as they would for the client.
 */
export async function withUser<T>(db: Db, userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!UUID_RE.test(userId)) throw new Error("withUser: userId must be a UUID");
  const claims = JSON.stringify({ sub: userId, role: "authenticated" });
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('request.jwt.claims', ${claims}, true), set_config('role', 'authenticated', true)`,
    );
    return fn(tx);
  });
}
