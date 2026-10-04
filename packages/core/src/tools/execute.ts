import { randomUUID } from "node:crypto";
import { withUser, type Db, type Tx } from "@diana/db";
import { auditLogs, domainEvents } from "@diana/db/schema";
import { DomainError } from "../errors";
import { decide, type Actor } from "../policy";
import type { z } from "zod";
import type { AnyTool, EntityRef, ToolContext } from "./types";

export interface ToolCall {
  userId: string;
  actor: Actor;
  /** Correlates every tool call made while handling one request or agent run. */
  requestId?: string;
  /** Set only after the user explicitly approved this exact call. */
  approved?: boolean;
}

export type ToolOutcome<O = unknown> =
  | { status: "ok"; data: O }
  | { status: "needs_approval"; tool: string; input: unknown }
  | { status: "invalid_input"; issues: { path: string; message: string }[] }
  | { status: "error"; code: DomainError["code"]; message: string };

type AuditRow = typeof auditLogs.$inferInsert;

/**
 * The single entry point for every write in the system (ADR-005): validate input,
 * apply the risk policy, run the tool in an RLS-scoped transaction, and record
 * audit + outbox events atomically with the change.
 *
 * Unexpected errors are audited and rethrown; expected DomainErrors are returned.
 */
export async function executeTool(
  db: Db,
  registry: ReadonlyMap<string, AnyTool>,
  call: ToolCall,
  name: string,
  rawInput: unknown,
): Promise<ToolOutcome> {
  const tool = registry.get(name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);

  const requestId = call.requestId ?? randomUUID();
  const base = {
    ownerId: call.userId,
    requestId,
    actor: call.actor,
    tool: tool.name,
    riskLevel: tool.risk,
    input: (rawInput ?? {}) as Record<string, unknown>,
  } satisfies Partial<AuditRow>;
  // Reads by the user are not worth an audit row; everything else is (SPEC §48).
  const audited = tool.risk > 0 || call.actor !== "user";

  const parsed = (tool.input as z.ZodType).safeParse(rawInput);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    if (audited) {
      await auditSeparately(db, call.userId, {
        ...base,
        approval: "not_required",
        outcome: "error",
        error: `invalid input: ${issues.map((i) => `${i.path} ${i.message}`).join("; ")}`,
      });
    }
    return { status: "invalid_input", issues };
  }

  const decision = decide(tool.risk, call.actor, call.approved ?? false);
  if (decision.kind === "needs_approval") {
    await auditSeparately(db, call.userId, { ...base, approval: "pending", outcome: "needs_approval" });
    return { status: "needs_approval", tool: tool.name, input: parsed.data };
  }

  try {
    return await withUser(db, call.userId, async (tx) => {
      const ctx: ToolContext = {
        userId: call.userId,
        actor: call.actor,
        requestId,
        tx,
        emit: (type, entity, payload = {}) => emit(tx, requestId, type, entity, payload),
      };
      const result = await tool.run(ctx, parsed.data);
      if (audited) {
        await tx.insert(auditLogs).values({
          ...base,
          approval: decision.approval,
          outcome: "success",
          result: toJson(result.data),
          entityType: result.entity?.type,
          entityId: result.entity?.id,
        });
      }
      return { status: "ok", data: result.data };
    });
  } catch (err) {
    // The tool's transaction rolled back, so the failure is recorded in a new one.
    const message = err instanceof Error ? err.message : String(err);
    await auditSeparately(db, call.userId, {
      ...base,
      approval: decision.approval,
      outcome: "error",
      error: message,
    });
    if (err instanceof DomainError) return { status: "error", code: err.code, message };
    throw err;
  }
}

async function emit(
  tx: Tx,
  requestId: string,
  type: string,
  entity: EntityRef,
  payload: Record<string, unknown>,
) {
  // No .returning(): users may insert into the outbox but not read it.
  await tx.insert(domainEvents).values({
    requestId,
    type,
    entityType: entity.type,
    entityId: entity.id,
    payload,
  });
}

async function auditSeparately(db: Db, userId: string, row: AuditRow) {
  await withUser(db, userId, (tx) => tx.insert(auditLogs).values(row));
}

function toJson(value: unknown): unknown {
  return value === undefined ? null : JSON.parse(JSON.stringify(value));
}
