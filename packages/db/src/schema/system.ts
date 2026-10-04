import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { id, ownerId } from "./_shared";

export const actorKind = pgEnum("actor_kind", ["user", "assistant", "telegram", "worker", "system"]);
export const approvalState = pgEnum("approval_state", [
  "not_required",
  "pending",
  "approved",
  "rejected",
]);
export const toolOutcome = pgEnum("tool_outcome", ["success", "error", "needs_approval"]);

/**
 * Append-only record of every tool execution (SPEC §48, ADR-005).
 * Users may insert and read their own rows; there are no update/delete policies.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    ownerId: ownerId(),
    requestId: uuid("request_id").notNull(),
    actor: actorKind("actor").notNull(),
    tool: text("tool").notNull(),
    riskLevel: smallint("risk_level").notNull(),
    input: jsonb("input").notNull(),
    approval: approvalState("approval").notNull(),
    outcome: toolOutcome("outcome").notNull(),
    result: jsonb("result"),
    error: text("error"),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_owner_created_idx").on(t.ownerId, t.createdAt),
    pgPolicy("audit_logs_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`app.can_read(${t.ownerId}, null)`,
    }),
    pgPolicy("audit_logs_insert", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`app.can_write(${t.ownerId}, null)`,
    }),
  ],
);

/**
 * Transactional outbox (ADR-005): written in the same transaction as the change it describes,
 * consumed by the worker. Users can only insert; processing columns are worker-owned.
 */
export const domainEvents = pgTable(
  "domain_events",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    ownerId: ownerId(),
    requestId: uuid("request_id").notNull(),
    type: text("type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    payload: jsonb("payload").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
  },
  (t) => [
    index("domain_events_unprocessed_idx").on(t.id).where(sql`${t.processedAt} is null`),
    pgPolicy("domain_events_insert", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`app.can_write(${t.ownerId}, null)`,
    }),
  ],
);
