import { index, jsonb, pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, ownedPolicies, ownerId, timestamps } from "./_shared";

export const captureSource = pgEnum("capture_source", ["web", "telegram", "api"]);
export const captureStatus = pgEnum("capture_status", [
  "pending",
  "parsed",
  "confirmed",
  "discarded",
  "failed",
]);
/** ADR-011: untrusted content is data for models, never instructions. */
export const contentTrust = pgEnum("content_trust", ["trusted", "untrusted"]);

/**
 * Raw input, saved before any AI call so a capture is never lost (ADR-006).
 * `parsed` holds the AI draft; the confirmed entity is referenced by result_type/result_id.
 */
export const captures = pgTable(
  "captures",
  {
    id: id(),
    ownerId: ownerId(),
    rawText: text("raw_text").notNull(),
    source: captureSource("source").notNull(),
    trust: contentTrust("trust").notNull().default("trusted"),
    status: captureStatus("status").notNull().default("pending"),
    parsed: jsonb("parsed"),
    parseError: text("parse_error"),
    resultType: text("result_type"),
    resultId: uuid("result_id"),
    /** Source-side id (e.g. Telegram update id) so redelivered webhooks are idempotent. */
    externalRef: text("external_ref"),
    ...timestamps(),
  },
  (t) => [
    index("captures_owner_status_idx").on(t.ownerId, t.status),
    uniqueIndex("captures_external_ref_uq").on(t.ownerId, t.source, t.externalRef),
    ...ownedPolicies("captures", t.ownerId),
  ],
);
