import type { Tx } from "@diana/db";
import { captures, milestones, projects, taskDependencies, tasks } from "@diana/db/schema";
import { and, asc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import { DomainError, invalid, notFound } from "../errors";
import { defineTool } from "./types";

export type Task = typeof tasks.$inferSelect;

const uuid = z.uuid();
const openStatuses = ["inbox", "todo", "in_progress", "blocked"] as const;

const createTaskInput = z
  .object({
    title: z.string().trim().min(1).max(500),
    notes: z.string().max(20_000).optional(),
    projectId: uuid.optional(),
    milestoneId: uuid.optional(),
    parentTaskId: uuid.optional(),
    status: z.enum(["inbox", "todo"]).default("inbox"),
    priority: z.number().int().min(1).max(4).default(3).describe("1 = highest, 4 = lowest"),
    dueAt: z.iso.datetime({ offset: true }).optional().describe("Exact deadline with offset"),
    dueDate: z.iso.date().optional().describe("All-day deadline, YYYY-MM-DD in the user's zone"),
    estimateMinutes: z.number().int().positive().max(10_000).optional(),
    energy: z.enum(["low", "medium", "high"]).optional(),
    tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
    captureId: uuid.optional(),
  })
  .refine((v) => !(v.dueAt && v.dueDate), { message: "Give either dueAt or dueDate, not both" });

export const createTask = defineTool({
  name: "tasks.create",
  description:
    "Create a task. Only set fields the user stated or clearly implied; leave unknown fields out.",
  risk: 1,
  input: createTaskInput,
  async run(ctx, input) {
    const links = await resolveLinks(ctx.tx, input);
    const [task] = await ctx.tx
      .insert(tasks)
      .values({
        ownerId: ctx.userId,
        title: input.title,
        notes: input.notes,
        status: input.status,
        priority: input.priority,
        dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
        dueDate: input.dueDate,
        estimateMinutes: input.estimateMinutes,
        energy: input.energy,
        tags: input.tags,
        ...links,
      })
      .returning();
    if (!task) throw new Error("insert returned no row");
    await ctx.emit("task.created", { type: "task", id: task.id }, { title: task.title });
    return { data: task, entity: { type: "task", id: task.id } };
  },
});

export const completeTask = defineTool({
  name: "tasks.complete",
  description: "Mark a task as done. Completing an already-done task is a no-op.",
  risk: 1,
  input: z.object({ id: uuid }),
  async run(ctx, { id }) {
    const [done] = await ctx.tx
      .update(tasks)
      .set({ status: "done", completedAt: sql`now()`, blockedReason: null })
      .where(and(eq(tasks.id, id), inArray(tasks.status, [...openStatuses])))
      .returning();
    if (done) {
      await ctx.emit("task.completed", { type: "task", id });
      return { data: done, entity: { type: "task", id } };
    }
    const [existing] = await ctx.tx.select().from(tasks).where(eq(tasks.id, id));
    if (!existing) throw notFound("task", id);
    if (existing.status === "cancelled") throw invalid("A cancelled task cannot be completed");
    return { data: existing, entity: { type: "task", id } };
  },
});

const updateTaskInput = z
  .object({
    id: uuid,
    title: z.string().trim().min(1).max(500).optional(),
    notes: z.string().max(20_000).nullable().optional(),
    status: z
      .enum(["inbox", "todo", "in_progress", "blocked", "cancelled"])
      .optional()
      .describe("Use tasks.complete to mark done. Setting a status on a done task reopens it."),
    priority: z.number().int().min(1).max(4).optional().describe("1 = highest, 4 = lowest"),
    dueAt: z.iso.datetime({ offset: true }).nullable().optional(),
    dueDate: z.iso.date().nullable().optional(),
    estimateMinutes: z.number().int().positive().max(10_000).nullable().optional(),
    projectId: uuid.nullable().optional(),
    blockedReason: z.string().max(1_000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).some((k) => k !== "id" && v[k as keyof typeof v] !== undefined), {
    message: "Nothing to update",
  })
  .refine((v) => !(v.dueAt && v.dueDate), { message: "Give either dueAt or dueDate, not both" });

export const updateTask = defineTool({
  name: "tasks.update",
  description:
    "Change fields of an existing task. Only pass fields that should change; null clears an optional field.",
  risk: 1,
  input: updateTaskInput,
  async run(ctx, input) {
    const [existing] = await ctx.tx.select().from(tasks).where(eq(tasks.id, input.id));
    if (!existing) throw notFound("task", input.id);

    const patch: Partial<typeof tasks.$inferInsert> = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.priority !== undefined) patch.priority = input.priority;
    if (input.estimateMinutes !== undefined) patch.estimateMinutes = input.estimateMinutes;
    if (input.blockedReason !== undefined) patch.blockedReason = input.blockedReason;

    if (input.status !== undefined) {
      patch.status = input.status;
      patch.completedAt = null;
      if (input.status !== "blocked" && input.blockedReason === undefined) patch.blockedReason = null;
    }

    // A task has one kind of deadline; setting one clears the other (ADR-007).
    if (input.dueAt !== undefined) {
      patch.dueAt = input.dueAt ? new Date(input.dueAt) : null;
      if (input.dueAt) patch.dueDate = null;
    }
    if (input.dueDate !== undefined) {
      patch.dueDate = input.dueDate;
      if (input.dueDate) patch.dueAt = null;
    }

    if (input.projectId !== undefined) {
      if (input.projectId) await assertProject(ctx.tx, input.projectId);
      patch.projectId = input.projectId;
      // A milestone belongs to one project, so moving the task detaches it.
      if (input.projectId !== existing.projectId) patch.milestoneId = null;
    }

    const [task] = await ctx.tx.update(tasks).set(patch).where(eq(tasks.id, input.id)).returning();
    if (!task) throw notFound("task", input.id);
    await ctx.emit("task.updated", { type: "task", id: task.id }, { fields: Object.keys(patch) });
    return { data: task, entity: { type: "task", id: task.id } };
  },
});

const dependencyInput = z.object({
  taskId: uuid.describe("The task that has to wait"),
  dependsOnTaskId: uuid.describe("The task that must be done first"),
});

export const addDependency = defineTool({
  name: "tasks.addDependency",
  description: "Make one task wait for another. Rejects links that would form a cycle.",
  risk: 1,
  input: dependencyInput,
  async run(ctx, { taskId, dependsOnTaskId }) {
    if (taskId === dependsOnTaskId) throw invalid("A task cannot depend on itself");
    // Resolve both ends under RLS: foreign keys would accept another user's task id.
    const found = await ctx.tx
      .select({ id: tasks.id })
      .from(tasks)
      .where(inArray(tasks.id, [taskId, dependsOnTaskId]));
    for (const id of [taskId, dependsOnTaskId]) {
      if (!found.some((t) => t.id === id)) throw notFound("task", id);
    }
    if (await reaches(ctx.tx, dependsOnTaskId, taskId)) {
      throw new DomainError("conflict", "That dependency would create a cycle");
    }
    await ctx.tx
      .insert(taskDependencies)
      .values({ ownerId: ctx.userId, taskId, dependsOnTaskId })
      .onConflictDoNothing();
    await ctx.emit("task.dependency_added", { type: "task", id: taskId }, { dependsOnTaskId });
    return { data: { taskId, dependsOnTaskId }, entity: { type: "task", id: taskId } };
  },
});

export const removeDependency = defineTool({
  name: "tasks.removeDependency",
  description: "Remove a dependency between two tasks. Removing a missing link is a no-op.",
  risk: 1,
  input: dependencyInput,
  async run(ctx, { taskId, dependsOnTaskId }) {
    const removed = await ctx.tx
      .delete(taskDependencies)
      .where(and(eq(taskDependencies.taskId, taskId), eq(taskDependencies.dependsOnTaskId, dependsOnTaskId)))
      .returning();
    if (removed.length > 0) {
      await ctx.emit("task.dependency_removed", { type: "task", id: taskId }, { dependsOnTaskId });
    }
    return { data: { taskId, dependsOnTaskId }, entity: { type: "task", id: taskId } };
  },
});

export const listDependencies = defineTool({
  name: "tasks.listDependencies",
  description: "List every dependency link: which task waits for which.",
  risk: 0,
  input: z.object({}),
  async run(ctx) {
    const rows = await ctx.tx
      .select({ taskId: taskDependencies.taskId, dependsOnTaskId: taskDependencies.dependsOnTaskId })
      .from(taskDependencies);
    return { data: rows };
  },
});

/** True when `target` is reachable from `start` by following "depends on" links. */
async function reaches(tx: Tx, start: string, target: string): Promise<boolean> {
  const seen = new Set<string>([start]);
  let frontier = [start];
  while (frontier.length > 0) {
    const edges = await tx
      .select({ next: taskDependencies.dependsOnTaskId })
      .from(taskDependencies)
      .where(inArray(taskDependencies.taskId, frontier));
    frontier = [];
    for (const { next } of edges) {
      if (next === target) return true;
      if (!seen.has(next)) {
        seen.add(next);
        frontier.push(next);
      }
    }
  }
  return false;
}

async function assertProject(tx: Tx, projectId: string) {
  const [project] = await tx
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), notInArray(projects.status, ["archived"])));
  if (!project) throw notFound("project", projectId);
}

export const listTasks = defineTool({
  name: "tasks.list",
  description: "List the user's tasks. Defaults to open tasks, highest priority first.",
  risk: 0,
  input: z.object({
    status: z.enum(["open", "done", "all"]).default("open"),
    projectId: uuid.optional(),
    limit: z.number().int().min(1).max(500).default(100),
  }),
  async run(ctx, input) {
    const filters = [
      input.status === "open" ? inArray(tasks.status, [...openStatuses]) : undefined,
      input.status === "done" ? eq(tasks.status, "done") : undefined,
      input.projectId ? eq(tasks.projectId, input.projectId) : undefined,
    ];
    const rows = await ctx.tx
      .select()
      .from(tasks)
      .where(and(...filters))
      .orderBy(asc(tasks.priority), sql`coalesce(${tasks.dueAt}::date, ${tasks.dueDate}) nulls last`, asc(tasks.createdAt))
      .limit(input.limit);
    return { data: rows };
  },
});

/**
 * Foreign keys are checked without RLS, so a caller could reference another user's
 * project by id. Resolve every link under RLS first, and derive the project from the
 * milestone or parent task when it was not given.
 */
async function resolveLinks(
  tx: Tx,
  input: { projectId?: string; milestoneId?: string; parentTaskId?: string; captureId?: string },
) {
  let projectId = input.projectId;

  if (input.captureId) {
    const [capture] = await tx.select({ id: captures.id }).from(captures).where(eq(captures.id, input.captureId));
    if (!capture) throw notFound("capture", input.captureId);
  }

  if (input.parentTaskId) {
    const [parent] = await tx
      .select({ projectId: tasks.projectId })
      .from(tasks)
      .where(eq(tasks.id, input.parentTaskId));
    if (!parent) throw notFound("parent task", input.parentTaskId);
    projectId ??= parent.projectId ?? undefined;
  }

  if (input.milestoneId) {
    const [milestone] = await tx
      .select({ projectId: milestones.projectId })
      .from(milestones)
      .where(eq(milestones.id, input.milestoneId));
    if (!milestone) throw notFound("milestone", input.milestoneId);
    if (projectId && projectId !== milestone.projectId) {
      throw invalid("Milestone belongs to a different project");
    }
    projectId = milestone.projectId;
  }

  if (projectId) await assertProject(tx, projectId);

  return {
    projectId,
    milestoneId: input.milestoneId,
    parentTaskId: input.parentTaskId,
    captureId: input.captureId,
  };
}
