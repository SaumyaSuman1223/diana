import "server-only";
import { executeTool, toolRegistry, type ToolOutcome } from "@diana/core";
import { getDb } from "./db";
import { requireUserId } from "./dal";

/** Run a domain tool as the signed-in user. The only way UI code writes data (ADR-005). */
export async function runTool<O = unknown>(name: string, input: unknown): Promise<ToolOutcome<O>> {
  const userId = await requireUserId();
  return (await executeTool(getDb(), toolRegistry, { userId, actor: "user" }, name, input)) as ToolOutcome<O>;
}
