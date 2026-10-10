import { goals, projects } from "@diana/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { notFound } from "../errors";
import { defineTool } from "./types";

export type Project = typeof projects.$inferSelect;

export const createProject = defineTool({
  name: "projects.create",
  description: "Create a project with an optional objective, goal and due date.",
  risk: 1,
  input: z.object({
    title: z.string().trim().min(1).max(200),
    objective: z.string().max(5_000).optional(),
    goalId: z.uuid().optional(),
    dueDate: z.iso.date().optional(),
  }),
  async run(ctx, input) {
    if (input.goalId) {
      const [goal] = await ctx.tx.select({ id: goals.id }).from(goals).where(eq(goals.id, input.goalId));
      if (!goal) throw notFound("goal", input.goalId);
    }
    const [project] = await ctx.tx
      .insert(projects)
      .values({ ownerId: ctx.userId, ...input })
      .returning();
    if (!project) throw new Error("insert returned no row");
    await ctx.emit("project.created", { type: "project", id: project.id }, { title: project.title });
    return { data: project, entity: { type: "project", id: project.id } };
  },
});

export const listProjects = defineTool({
  name: "projects.list",
  description: "List the user's projects, active ones by default.",
  risk: 0,
  input: z.object({
    status: z.array(z.enum(["active", "paused", "completed", "archived"])).default(["active"]),
  }),
  async run(ctx, input) {
    const rows = await ctx.tx
      .select()
      .from(projects)
      .where(and(inArray(projects.status, input.status)))
      .orderBy(asc(projects.dueDate), asc(projects.title));
    return { data: rows };
  },
});

export const updateProject = defineTool({
  name: "projects.update",
  description: "Change a project's title, objective, status or due date. null clears an optional field.",
  risk: 1,
  input: z
    .object({
      id: z.uuid(),
      title: z.string().trim().min(1).max(200).optional(),
      objective: z.string().max(5_000).nullable().optional(),
      status: z.enum(["active", "paused", "completed", "archived"]).optional(),
      dueDate: z.iso.date().nullable().optional(),
    })
    .refine((v) => Object.keys(v).some((k) => k !== "id" && v[k as keyof typeof v] !== undefined), {
      message: "Nothing to update",
    }),
  async run(ctx, { id, ...patch }) {
    const [project] = await ctx.tx.update(projects).set(patch).where(eq(projects.id, id)).returning();
    if (!project) throw notFound("project", id);
    await ctx.emit("project.updated", { type: "project", id }, { fields: Object.keys(patch) });
    return { data: project, entity: { type: "project", id } };
  },
});
