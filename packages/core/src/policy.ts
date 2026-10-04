/**
 * Risk levels from SPEC §47.
 * 0 read · 1 internal write · 2 external write · 3 consequential (send, delete, purchase)
 */
export type RiskLevel = 0 | 1 | 2 | 3;

export type Actor = "user" | "assistant" | "telegram" | "worker" | "system";

export type PolicyDecision =
  | { kind: "allow"; approval: "not_required" | "approved" }
  | { kind: "needs_approval" };

/**
 * Decide whether a tool call may run now.
 *
 * A direct user action (clicking in the UI, sending a Telegram command) is its own
 * confirmation. Everything initiated by the assistant or automations is gated by risk.
 * `approved` must come from an explicit user approval of this exact call — never from
 * model output or retrieved content (ADR-011).
 */
export function decide(risk: RiskLevel, actor: Actor, approved: boolean): PolicyDecision {
  if (actor === "user" || actor === "telegram") return { kind: "allow", approval: "not_required" };
  if (risk <= 1) return { kind: "allow", approval: "not_required" };
  if (approved) return { kind: "allow", approval: "approved" };
  return { kind: "needs_approval" };
}
