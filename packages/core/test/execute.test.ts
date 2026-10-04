import { withUser } from "@diana/db";
import { auditLogs, domainEvents, tasks } from "@diana/db/schema";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { defineTool, executeTool, toolRegistry, type AnyTool, type Task } from "../src";
import { createTestUser, deleteTestUsers, testDb } from "../../db/test/helpers";

const { db, close } = testDb();
let alice: string;
let bob: string;

beforeAll(async () => {
  alice = await createTestUser(db);
  bob = await createTestUser(db);
});

afterAll(async () => {
  await deleteTestUsers(db, [alice, bob]);
  await close();
});

const run = (userId: string, name: string, input: unknown, actor: "user" | "assistant" = "user") =>
  executeTool(db, toolRegistry, { userId, actor }, name, input);

/** Outbox rows are invisible to users, so inspect them with the privileged connection. */
const eventsFor = (entityId: string) =>
  db.select().from(domainEvents).where(eq(domainEvents.entityId, entityId));

describe("executeTool", () => {
  it("commits the task, its audit row and its event together", async () => {
    const out = await run(alice, "tasks.create", { title: "Run Stage 3 training", priority: 1 });
    expect(out.status).toBe("ok");
    const task = (out as { data: Task }).data;

    const audit = await withUser(db, alice, (tx) =>
      tx.select().from(auditLogs).where(eq(auditLogs.entityId, task.id)),
    );
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ tool: "tasks.create", outcome: "success", actor: "user" });

    const events = await eventsFor(task.id);
    expect(events.map((e) => e.type)).toEqual(["task.created"]);
    expect(events[0]?.ownerId).toBe(alice);
  });

  it("rolls back the change and the event when the tool fails, but still audits", async () => {
    const failing = defineTool({
      name: "test.fail_after_write",
      description: "writes, emits, then throws",
      risk: 1,
      input: z.object({ title: z.string() }),
      async run(ctx, input) {
        const [t] = await ctx.tx.insert(tasks).values({ title: input.title }).returning();
        await ctx.emit("task.created", { type: "task", id: t!.id });
        throw new Error("boom");
      },
    });
    const registry = new Map<string, AnyTool>([[failing.name, failing]]);
    const title = `rollback-${crypto.randomUUID()}`;

    await expect(
      executeTool(db, registry, { userId: alice, actor: "user" }, failing.name, { title }),
    ).rejects.toThrow("boom");

    // `db` is the privileged connection, so this would see the row if it had committed.
    expect(await db.select().from(tasks).where(eq(tasks.title, title))).toHaveLength(0);

    const audit = await withUser(db, alice, (tx) =>
      tx.select().from(auditLogs).where(eq(auditLogs.tool, failing.name)),
    );
    expect(audit.at(-1)).toMatchObject({ outcome: "error", error: "boom" });
  });

  it("returns validation issues instead of throwing", async () => {
    const out = await run(alice, "tasks.create", { title: "", dueAt: "2026-10-01T10:00:00Z", dueDate: "2026-10-01" });
    expect(out.status).toBe("invalid_input");
  });

  it("does not let a user link to another user's project", async () => {
    const project = await run(alice, "projects.create", { title: "BTP — FedPCL" });
    const projectId = (project as { data: { id: string } }).data.id;

    const out = await run(bob, "tasks.create", { title: "sneaky", projectId });
    expect(out).toMatchObject({ status: "error", code: "not_found" });
  });

  it("inherits the project from the parent task", async () => {
    const project = await run(alice, "projects.create", { title: "DSP" });
    const projectId = (project as { data: { id: string } }).data.id;
    const parent = await run(alice, "tasks.create", { title: "Assignment 3", projectId });
    const parentId = (parent as { data: Task }).data.id;

    const child = await run(alice, "tasks.create", { title: "Question 2", parentTaskId: parentId });
    expect((child as { data: Task }).data.projectId).toBe(projectId);
  });

  it("completes tasks idempotently and emits one event", async () => {
    const created = await run(alice, "tasks.create", { title: "Buy USB cable" });
    const id = (created as { data: Task }).data.id;

    const first = await run(alice, "tasks.complete", { id });
    const second = await run(alice, "tasks.complete", { id });
    expect((first as { data: Task }).data.status).toBe("done");
    expect((second as { data: Task }).data.status).toBe("done");

    const events = await eventsFor(id);
    expect(events.filter((e) => e.type === "task.completed")).toHaveLength(1);
  });

  it("stores captures idempotently per external reference", async () => {
    const input = { rawText: "ask professor about dataset", source: "telegram", externalRef: "upd-42" };
    const a = await run(alice, "captures.create", input);
    const b = await run(alice, "captures.create", input);
    expect((a as { data: { id: string } }).data.id).toBe((b as { data: { id: string } }).data.id);
  });

  it("only lists the caller's tasks", async () => {
    await run(bob, "tasks.create", { title: "bob's private task" });
    const out = await run(alice, "tasks.list", {});
    const titles = (out as { data: Task[] }).data.map((t) => t.title);
    expect(titles).not.toContain("bob's private task");
  });
});
