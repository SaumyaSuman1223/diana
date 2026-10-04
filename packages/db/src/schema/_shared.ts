import { sql, type SQL } from "drizzle-orm";
import { pgPolicy, timestamp, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { authenticatedRole, authUsers } from "drizzle-orm/supabase";

export const id = () => uuid("id").primaryKey().defaultRandom();

/** Owner of the row. Defaults to the caller so RLS-scoped inserts cannot forge it. */
export const ownerId = () =>
  uuid("owner_id")
    .notNull()
    .default(sql`auth.uid()`)
    .references(() => authUsers.id, { onDelete: "cascade" });

export const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/**
 * Standard RLS policies (ADR-004). Every access decision goes through
 * app.can_read / app.can_write so sharing can later be added in one place.
 * `project` is the project the row belongs to, if any — the future sharing unit.
 */
export function ownedPolicies(table: string, owner: AnyPgColumn, project?: AnyPgColumn) {
  const args: SQL = project ? sql`${owner}, ${project}` : sql`${owner}, null`;
  const read = sql`app.can_read(${args})`;
  const write = sql`app.can_write(${args})`;
  return [
    pgPolicy(`${table}_select`, { for: "select", to: authenticatedRole, using: read }),
    pgPolicy(`${table}_insert`, { for: "insert", to: authenticatedRole, withCheck: write }),
    pgPolicy(`${table}_update`, { for: "update", to: authenticatedRole, using: write, withCheck: write }),
    pgPolicy(`${table}_delete`, { for: "delete", to: authenticatedRole, using: write }),
  ];
}
