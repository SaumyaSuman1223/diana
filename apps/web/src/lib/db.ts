import "server-only";
import { createDb, type Db } from "@diana/db";
import { databaseUrl } from "./env";

// Reuse one pool across hot reloads in development.
const globalForDb = globalThis as unknown as { dianaDb?: Db };

export function getDb(): Db {
  // Serverless hosts run many instances; keep each one's pool small (see docs/DEPLOY.md).
  const max = Number(process.env.DATABASE_POOL_MAX) || undefined;
  globalForDb.dianaDb ??= createDb(databaseUrl(), { max }).db;
  return globalForDb.dianaDb;
}
