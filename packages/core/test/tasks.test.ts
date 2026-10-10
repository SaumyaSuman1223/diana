import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { executeTool, toolRegistry, type Project, type Task } from "../src";
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

const run = (userId: string, name: string, input: unknown) =>
  executeTool(db, toolRegistry, { userId, actor: "user" }, name, input);

async function create<T>(userId: string, name: string, input: unknown): Promise<T> {
  const out = await run(userId, name, input);
  if (out.status !== "ok") throw new Error(`${name} failed: ${JSON.stringify(out)}`);
  return out.data as T;
}

describe("tasks.update", () => {
  it("changes only the given fields and swaps deadline kinds", async () => {
    const task = await create<Task>(alice, "tasks.create", { title: "Draft report", dueDate: "2026-11-01" });
    const out = await run(alice, "tasks.update", {
      id: task.id,
      priority: 1,
      dueAt: "2026-11-02T10:00:00+05:30",
      estimateMinutes: 45,
    });
    const updated = (out as { data: Task }).data;
    expect(updated).toMatchObject({ title: "Draft report", priority: 1, estimateMinutes: 45, dueDate: null });
    expect(updated.dueAt).not.toBeNull();

    const cleared = await run(alice, "tasks.update", { id: task.id, estimateMinutes: null, dueAt: null });
    expect((cleared as { data: Task }).data).toMatchObject({ estimateMinutes: null, dueAt: null, dueDate: null });
  });

  it("reopens a done task and rejects an empty patch", async () => {
    const task = await create<Task>(alice, "tasks.create", { title: "Reopen me" });
    await run(alice, "tasks.complete", { id: task.id });
    const out = await run(alice, "tasks.update", { id: task.id, status: "todo" });
    expect((out as { data: Task }).data).toMatchObject({ status: "todo", completedAt: null });

    const empty = await run(alice, "tasks.update", { id: task.id });
    expect(empty.status).toBe("invalid_input");
  });

  it("cannot touch or move tasks into another user's data", async () => {
    const task = await create<Task>(alice, "tasks.create", { title: "Alice's" });
    const bobProject = await create<Project>(bob, "projects.create", { title: "Bob's project" });

    const asBob = await run(bob, "tasks.update", { id: task.id, title: "hijacked" });
    expect(asBob).toMatchObject({ status: "error", code: "not_found" });

    const link = await run(alice, "tasks.update", { id: task.id, projectId: bobProject.id });
    expect(link).toMatchObject({ status: "error", code: "not_found" });
  });
});

describe("task dependencies", () => {
  it("links tasks, lists the link, and rejects cycles and self links", async () => {
    const [a, b, c] = await Promise.all(
      ["A", "B", "C"].map((title) => create<Task>(alice, "tasks.create", { title })),
    );
    await create(alice, "tasks.addDependency", { taskId: a!.id, dependsOnTaskId: b!.id });
    await create(alice, "tasks.addDependency", { taskId: b!.id, dependsOnTaskId: c!.id });
    // Adding the same link twice is harmless.
    await create(alice, "tasks.addDependency", { taskId: a!.id, dependsOnTaskId: b!.id });

    const links = await create<{ taskId: string; dependsOnTaskId: string }[]>(alice, "tasks.listDependencies", {});
    expect(links).toHaveLength(2);

    const cycle = await run(alice, "tasks.addDependency", { taskId: c!.id, dependsOnTaskId: a!.id });
    expect(cycle).toMatchObject({ status: "error", code: "conflict" });
    const self = await run(alice, "tasks.addDependency", { taskId: a!.id, dependsOnTaskId: a!.id });
    expect(self).toMatchObject({ status: "error", code: "invalid" });

    await create(alice, "tasks.removeDependency", { taskId: a!.id, dependsOnTaskId: b!.id });
    const after = await create<unknown[]>(alice, "tasks.listDependencies", {});
    expect(after).toHaveLength(1);
  });

  it("will not link to another user's task", async () => {
    const mine = await create<Task>(alice, "tasks.create", { title: "Mine" });
    const theirs = await create<Task>(bob, "tasks.create", { title: "Theirs" });
    const out = await run(alice, "tasks.addDependency", { taskId: mine.id, dependsOnTaskId: theirs.id });
    expect(out).toMatchObject({ status: "error", code: "not_found" });
  });
});

describe("projects.update", () => {
  it("updates own project and not someone else's", async () => {
    const project = await create<Project>(alice, "projects.create", { title: "Old name" });
    const out = await run(alice, "projects.update", { id: project.id, title: "New name", status: "paused" });
    expect((out as { data: Project }).data).toMatchObject({ title: "New name", status: "paused" });

    const asBob = await run(bob, "projects.update", { id: project.id, title: "stolen" });
    expect(asBob).toMatchObject({ status: "error", code: "not_found" });
  });
});
