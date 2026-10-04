import type { Tx } from "@diana/db";
import { captures, milestones, projects, tasks } from "@diana/db/schema";
import { and, asc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import { invalid, notFound } from "../errors";
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

  if (projectId) {
    const [project] = await tx
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), notInArray(projects.status, ["archived"])));
    if (!project) throw notFound("project", projectId);
  }

  return {
    projectId,
    milestoneId: input.milestoneId,
    parentTaskId: input.parentTaskId,
    captureId: input.captureId,
  };
}
