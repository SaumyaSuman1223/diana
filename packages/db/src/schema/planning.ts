import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgEnum,
  pgPolicy,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { id, ownedPolicies, ownerId, timestamps } from "./_shared";
import { captures } from "./captures";

export const goalHorizon = pgEnum("goal_horizon", ["life", "year", "quarter", "month", "none"]);
export const goalStatus = pgEnum("goal_status", ["active", "paused", "achieved", "abandoned"]);
export const projectStatus = pgEnum("project_status", ["active", "paused", "completed", "archived"]);
export const milestoneStatus = pgEnum("milestone_status", ["open", "done"]);
export const taskStatus = pgEnum("task_status", [
  "inbox",
  "todo",
  "in_progress",
  "blocked",
  "done",
  "cancelled",
]);
export const energyLevel = pgEnum("energy_level", ["low", "medium", "high"]);

/** Goals nest through parent_id; `horizon` replaces SPEC §14's fixed five-level hierarchy. */
export const goals = pgTable(
  "goals",
  {
    id: id(),
    ownerId: ownerId(),
    parentId: uuid("parent_id").references((): AnyPgColumn => goals.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    horizon: goalHorizon("horizon").notNull().default("none"),
    status: goalStatus("status").notNull().default("active"),
    targetDate: date("target_date"),
    ...timestamps(),
  },
  (t) => [index("goals_owner_idx").on(t.ownerId), ...ownedPolicies("goals", t.ownerId)],
);

export const projects = pgTable(
  "projects",
  {
    id: id(),
    ownerId: ownerId(),
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    objective: text("objective"),
    status: projectStatus("status").notNull().default("active"),
    dueDate: date("due_date"),
    ...timestamps(),
  },
  (t) => [
    index("projects_owner_status_idx").on(t.ownerId, t.status),
    ...ownedPolicies("projects", t.ownerId, t.id),
  ],
);

export const milestones = pgTable(
  "milestones",
  {
    id: id(),
    ownerId: ownerId(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    status: milestoneStatus("status").notNull().default("open"),
    dueDate: date("due_date"),
    position: integer("position").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index("milestones_project_idx").on(t.projectId),
    ...ownedPolicies("milestones", t.ownerId, t.projectId),
  ],
);

/** Every link is optional (critique A10): most real tasks have no project or goal. */
export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    ownerId: ownerId(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    milestoneId: uuid("milestone_id").references(() => milestones.id, { onDelete: "set null" }),
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
    parentTaskId: uuid("parent_task_id").references((): AnyPgColumn => tasks.id, {
      onDelete: "cascade",
    }),
    captureId: uuid("capture_id").references(() => captures.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    notes: text("notes"),
    status: taskStatus("status").notNull().default("inbox"),
    /** 1 = highest, 4 = lowest. */
    priority: smallint("priority").notNull().default(3),
    /** Exactly-timed deadline. Mutually exclusive with dueDate (ADR-007). */
    dueAt: timestamp("due_at", { withTimezone: true }),
    /** All-day deadline in the owner's time zone. */
    dueDate: date("due_date"),
    estimateMinutes: integer("estimate_minutes"),
    energy: energyLevel("energy"),
    context: text("context"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    blockedReason: text("blocked_reason"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    check("tasks_priority_range", sql`${t.priority} between 1 and 4`),
    check("tasks_single_deadline", sql`${t.dueAt} is null or ${t.dueDate} is null`),
    check("tasks_estimate_positive", sql`${t.estimateMinutes} is null or ${t.estimateMinutes} > 0`),
    check(
      "tasks_completed_at_matches_status",
      sql`(${t.status} = 'done') = (${t.completedAt} is not null)`,
    ),
    index("tasks_owner_status_idx").on(t.ownerId, t.status),
    index("tasks_project_idx").on(t.projectId),
    index("tasks_parent_idx").on(t.parentTaskId),
    ...ownedPolicies("tasks", t.ownerId, t.projectId),
  ],
);

/** A dependency is visible exactly when its task is visible, so sharing needs no change here. */
export const taskDependencies = pgTable(
  "task_dependencies",
  {
    ownerId: ownerId(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    dependsOnTaskId: uuid("depends_on_task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.taskId, t.dependsOnTaskId] }),
    check("task_dependencies_no_self", sql`${t.taskId} <> ${t.dependsOnTaskId}`),
    index("task_dependencies_depends_on_idx").on(t.dependsOnTaskId),
    pgPolicy("task_dependencies_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`exists (select 1 from public.tasks where public.tasks.id = ${t.taskId})`,
    }),
    pgPolicy("task_dependencies_insert", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`app.can_write(${t.ownerId}, null)`,
    }),
    pgPolicy("task_dependencies_delete", {
      for: "delete",
      to: authenticatedRole,
      using: sql`app.can_write(${t.ownerId}, null)`,
    }),
  ],
);
