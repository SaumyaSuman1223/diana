import { captures } from "@diana/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { defineTool } from "./types";

export type Capture = typeof captures.$inferSelect;

/**
 * Save raw input before anything else touches it (ADR-006). Idempotent on
 * (source, externalRef) so redelivered webhooks do not create duplicates.
 */
export const createCapture = defineTool({
  name: "captures.create",
  description: "Store a raw captured thought for later classification.",
  risk: 1,
  input: z.object({
    rawText: z.string().trim().min(1).max(10_000),
    source: z.enum(["web", "telegram", "api"]),
    trust: z.enum(["trusted", "untrusted"]).default("trusted"),
    externalRef: z.string().max(200).optional(),
  }),
  async run(ctx, input) {
    const [created] = await ctx.tx
      .insert(captures)
      .values({ ownerId: ctx.userId, ...input })
      .onConflictDoNothing({ target: [captures.ownerId, captures.source, captures.externalRef] })
      .returning();
    if (created) {
      await ctx.emit("capture.created", { type: "capture", id: created.id });
      return { data: created, entity: { type: "capture", id: created.id } };
    }
    const [existing] = await ctx.tx
      .select()
      .from(captures)
      .where(
        and(
          eq(captures.ownerId, ctx.userId),
          eq(captures.source, input.source),
          eq(captures.externalRef, input.externalRef!),
        ),
      );
    if (!existing) throw new Error("capture conflict without an existing row");
    return { data: existing, entity: { type: "capture", id: existing.id } };
  },
});
