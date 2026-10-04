import "server-only";
import { createDb, type Db } from "@diana/db";
import { databaseUrl } from "./env";

// Reuse one pool across hot reloads in development.
const globalForDb = globalThis as unknown as { dianaDb?: Db };

export function getDb(): Db {
  globalForDb.dianaDb ??= createDb(databaseUrl()).db;
  return globalForDb.dianaDb;
}
