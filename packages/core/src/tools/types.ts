import type { Tx } from "@diana/db";
import type { z } from "zod";
import type { Actor, RiskLevel } from "../policy";

export interface EntityRef {
  type: string;
  id: string;
}

export interface ToolContext {
  userId: string;
  actor: Actor;
  requestId: string;
  /** RLS-scoped transaction; the row change, audit and events commit together. */
  tx: Tx;
  /** Append a domain event to the outbox inside the current transaction. */
  emit(type: string, entity: EntityRef, payload?: Record<string, unknown>): Promise<void>;
}

export interface ToolRunResult<O> {
  data: O;
  /** Primary entity affected, recorded in the audit log. */
  entity?: EntityRef;
}

export interface Tool<I extends z.ZodType = z.ZodType, O = unknown> {
  /** Dotted name, e.g. "tasks.create" (SPEC §46). */
  name: string;
  /** Written for the model as much as for humans. */
  description: string;
  risk: RiskLevel;
  input: I;
  run(ctx: ToolContext, input: z.output<I>): Promise<ToolRunResult<O>>;
}

export function defineTool<I extends z.ZodType, O>(tool: Tool<I, O>): Tool<I, O> {
  return tool;
}

// Registry entries are heterogeneous; inputs are validated before `run` is called.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTool = Tool<any, any>;
