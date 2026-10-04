import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { createDb, type Db } from "../src";

export function testDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set; run `pnpm db:start` and copy .env.example to .env");
  return createDb(url, { max: 4 });
}

/** Insert a user straight into auth.users (as the superuser connection). */
export async function createTestUser(db: Db): Promise<string> {
  const id = randomUUID();
  await db.execute(sql`
    insert into auth.users (id, email, aud, role, raw_user_meta_data)
    values (${id}, ${`${id}@test.local`}, 'authenticated', 'authenticated', '{"timezone":"Asia/Kolkata"}'::jsonb)
  `);
  return id;
}

export async function deleteTestUsers(db: Db, ids: string[]) {
  for (const id of ids) await db.execute(sql`delete from auth.users where id = ${id}`);
}
