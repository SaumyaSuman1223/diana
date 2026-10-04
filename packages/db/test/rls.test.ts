import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withUser } from "../src";
import { auditLogs, domainEvents, profiles, projects, tasks } from "../src/schema";
import { createTestUser, deleteTestUsers, testDb } from "./helpers";

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

describe("row level security", () => {
  it("creates a profile for each new auth user", async () => {
    const rows = await withUser(db, alice, (tx) => tx.select().from(profiles));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: alice, timezone: "Asia/Kolkata" });
  });

  it("owner_id defaults to the caller", async () => {
    const [task] = await withUser(db, alice, (tx) =>
      tx.insert(tasks).values({ title: "default owner" }).returning(),
    );
    expect(task?.ownerId).toBe(alice);
  });

  it("hides other users' rows", async () => {
    await withUser(db, alice, (tx) => tx.insert(tasks).values({ title: "alice only" }));
    const bobSees = await withUser(db, bob, (tx) =>
      tx.select().from(tasks).where(eq(tasks.title, "alice only")),
    );
    expect(bobSees).toHaveLength(0);
  });

  it("rejects inserting rows owned by someone else", async () => {
    await expect(
      withUser(db, bob, (tx) => tx.insert(projects).values({ ownerId: alice, title: "forged" })),
    ).rejects.toThrow(/row-level security/);
  });

  it("does not let users update or delete another user's rows", async () => {
    const [task] = await withUser(db, alice, (tx) =>
      tx.insert(tasks).values({ title: "untouchable" }).returning(),
    );
    const updated = await withUser(db, bob, (tx) =>
      tx.update(tasks).set({ title: "hijacked" }).where(eq(tasks.id, task!.id)).returning(),
    );
    const deleted = await withUser(db, bob, (tx) =>
      tx.delete(tasks).where(eq(tasks.id, task!.id)).returning(),
    );
    expect(updated).toHaveLength(0);
    expect(deleted).toHaveLength(0);
  });

  it("keeps audit logs append-only", async () => {
    const [row] = await withUser(db, alice, (tx) =>
      tx
        .insert(auditLogs)
        .values({
          requestId: crypto.randomUUID(),
          actor: "user",
          tool: "test",
          riskLevel: 0,
          input: {},
          approval: "not_required",
          outcome: "success",
        })
        .returning(),
    );
    const updated = await withUser(db, alice, (tx) =>
      tx.update(auditLogs).set({ tool: "rewritten" }).where(eq(auditLogs.id, row!.id)).returning(),
    );
    expect(updated).toHaveLength(0);
  });

  it("lets users write but not read the outbox", async () => {
    await withUser(db, alice, (tx) =>
      tx.insert(domainEvents).values({
        requestId: crypto.randomUUID(),
        type: "test.event",
        entityType: "test",
        entityId: crypto.randomUUID(),
      }),
    );
    const visible = await withUser(db, alice, (tx) => tx.select().from(domainEvents));
    expect(visible).toHaveLength(0);
  });

  it("runs as the authenticated role, not the connection's superuser", async () => {
    const [row] = await withUser(db, alice, (tx) =>
      tx.execute<{ role: string; uid: string }>(sql`select current_user as role, auth.uid() as uid`),
    );
    expect(row).toEqual({ role: "authenticated", uid: alice });
  });
});
