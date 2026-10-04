CREATE TYPE "public"."energy_level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."goal_horizon" AS ENUM('life', 'year', 'quarter', 'month', 'none');--> statement-breakpoint
CREATE TYPE "public"."goal_status" AS ENUM('active', 'paused', 'achieved', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."milestone_status" AS ENUM('open', 'done');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('active', 'paused', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('inbox', 'todo', 'in_progress', 'blocked', 'done', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."capture_source" AS ENUM('web', 'telegram', 'api');--> statement-breakpoint
CREATE TYPE "public"."capture_status" AS ENUM('pending', 'parsed', 'confirmed', 'discarded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."content_trust" AS ENUM('trusted', 'untrusted');--> statement-breakpoint
CREATE TYPE "public"."actor_kind" AS ENUM('user', 'assistant', 'telegram', 'worker', 'system');--> statement-breakpoint
CREATE TYPE "public"."approval_state" AS ENUM('not_required', 'pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."tool_outcome" AS ENUM('success', 'error', 'needs_approval');--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"working_hours" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid DEFAULT auth.uid() NOT NULL,
	"parent_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"horizon" "goal_horizon" DEFAULT 'none' NOT NULL,
	"status" "goal_status" DEFAULT 'active' NOT NULL,
	"target_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid DEFAULT auth.uid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"status" "milestone_status" DEFAULT 'open' NOT NULL,
	"due_date" date,
	"position" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "milestones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid DEFAULT auth.uid() NOT NULL,
	"goal_id" uuid,
	"title" text NOT NULL,
	"objective" text,
	"status" "project_status" DEFAULT 'active' NOT NULL,
	"due_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "task_dependencies" (
	"owner_id" uuid DEFAULT auth.uid() NOT NULL,
	"task_id" uuid NOT NULL,
	"depends_on_task_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_dependencies_task_id_depends_on_task_id_pk" PRIMARY KEY("task_id","depends_on_task_id"),
	CONSTRAINT "task_dependencies_no_self" CHECK ("task_dependencies"."task_id" <> "task_dependencies"."depends_on_task_id")
);
--> statement-breakpoint
ALTER TABLE "task_dependencies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid DEFAULT auth.uid() NOT NULL,
	"project_id" uuid,
	"milestone_id" uuid,
	"goal_id" uuid,
	"parent_task_id" uuid,
	"capture_id" uuid,
	"title" text NOT NULL,
	"notes" text,
	"status" "task_status" DEFAULT 'inbox' NOT NULL,
	"priority" smallint DEFAULT 3 NOT NULL,
	"due_at" timestamp with time zone,
	"due_date" date,
	"estimate_minutes" integer,
	"energy" "energy_level",
	"context" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"blocked_reason" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_priority_range" CHECK ("tasks"."priority" between 1 and 4),
	CONSTRAINT "tasks_single_deadline" CHECK ("tasks"."due_at" is null or "tasks"."due_date" is null),
	CONSTRAINT "tasks_estimate_positive" CHECK ("tasks"."estimate_minutes" is null or "tasks"."estimate_minutes" > 0),
	CONSTRAINT "tasks_completed_at_matches_status" CHECK (("tasks"."status" = 'done') = ("tasks"."completed_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "captures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid DEFAULT auth.uid() NOT NULL,
	"raw_text" text NOT NULL,
	"source" "capture_source" NOT NULL,
	"trust" "content_trust" DEFAULT 'trusted' NOT NULL,
	"status" "capture_status" DEFAULT 'pending' NOT NULL,
	"parsed" jsonb,
	"parse_error" text,
	"result_type" text,
	"result_id" uuid,
	"external_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "captures" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid DEFAULT auth.uid() NOT NULL,
	"request_id" uuid NOT NULL,
	"actor" "actor_kind" NOT NULL,
	"tool" text NOT NULL,
	"risk_level" smallint NOT NULL,
	"input" jsonb NOT NULL,
	"approval" "approval_state" NOT NULL,
	"outcome" "tool_outcome" NOT NULL,
	"result" jsonb,
	"error" text,
	"entity_type" text,
	"entity_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "domain_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "domain_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"owner_id" uuid DEFAULT auth.uid() NOT NULL,
	"request_id" uuid NOT NULL,
	"type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text
);
--> statement-breakpoint
ALTER TABLE "domain_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_parent_id_goals_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_depends_on_task_id_tasks_id_fk" FOREIGN KEY ("depends_on_task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_task_id_tasks_id_fk" FOREIGN KEY ("parent_task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_capture_id_captures_id_fk" FOREIGN KEY ("capture_id") REFERENCES "public"."captures"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "captures" ADD CONSTRAINT "captures_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_events" ADD CONSTRAINT "domain_events_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "goals_owner_idx" ON "goals" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "milestones_project_idx" ON "milestones" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "projects_owner_status_idx" ON "projects" USING btree ("owner_id","status");--> statement-breakpoint
CREATE INDEX "task_dependencies_depends_on_idx" ON "task_dependencies" USING btree ("depends_on_task_id");--> statement-breakpoint
CREATE INDEX "tasks_owner_status_idx" ON "tasks" USING btree ("owner_id","status");--> statement-breakpoint
CREATE INDEX "tasks_project_idx" ON "tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "tasks_parent_idx" ON "tasks" USING btree ("parent_task_id");--> statement-breakpoint
CREATE INDEX "captures_owner_status_idx" ON "captures" USING btree ("owner_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "captures_external_ref_uq" ON "captures" USING btree ("owner_id","source","external_ref");--> statement-breakpoint
CREATE INDEX "audit_logs_owner_created_idx" ON "audit_logs" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "domain_events_unprocessed_idx" ON "domain_events" USING btree ("id") WHERE "domain_events"."processed_at" is null;--> statement-breakpoint
CREATE POLICY "profiles_select" ON "profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.can_read("profiles"."id", null));--> statement-breakpoint
CREATE POLICY "profiles_insert" ON "profiles" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (app.can_write("profiles"."id", null));--> statement-breakpoint
CREATE POLICY "profiles_update" ON "profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (app.can_write("profiles"."id", null)) WITH CHECK (app.can_write("profiles"."id", null));--> statement-breakpoint
CREATE POLICY "profiles_delete" ON "profiles" AS PERMISSIVE FOR DELETE TO "authenticated" USING (app.can_write("profiles"."id", null));--> statement-breakpoint
CREATE POLICY "goals_select" ON "goals" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.can_read("goals"."owner_id", null));--> statement-breakpoint
CREATE POLICY "goals_insert" ON "goals" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (app.can_write("goals"."owner_id", null));--> statement-breakpoint
CREATE POLICY "goals_update" ON "goals" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (app.can_write("goals"."owner_id", null)) WITH CHECK (app.can_write("goals"."owner_id", null));--> statement-breakpoint
CREATE POLICY "goals_delete" ON "goals" AS PERMISSIVE FOR DELETE TO "authenticated" USING (app.can_write("goals"."owner_id", null));--> statement-breakpoint
CREATE POLICY "milestones_select" ON "milestones" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.can_read("milestones"."owner_id", "milestones"."project_id"));--> statement-breakpoint
CREATE POLICY "milestones_insert" ON "milestones" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (app.can_write("milestones"."owner_id", "milestones"."project_id"));--> statement-breakpoint
CREATE POLICY "milestones_update" ON "milestones" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (app.can_write("milestones"."owner_id", "milestones"."project_id")) WITH CHECK (app.can_write("milestones"."owner_id", "milestones"."project_id"));--> statement-breakpoint
CREATE POLICY "milestones_delete" ON "milestones" AS PERMISSIVE FOR DELETE TO "authenticated" USING (app.can_write("milestones"."owner_id", "milestones"."project_id"));--> statement-breakpoint
CREATE POLICY "projects_select" ON "projects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.can_read("projects"."owner_id", "projects"."id"));--> statement-breakpoint
CREATE POLICY "projects_insert" ON "projects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (app.can_write("projects"."owner_id", "projects"."id"));--> statement-breakpoint
CREATE POLICY "projects_update" ON "projects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (app.can_write("projects"."owner_id", "projects"."id")) WITH CHECK (app.can_write("projects"."owner_id", "projects"."id"));--> statement-breakpoint
CREATE POLICY "projects_delete" ON "projects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (app.can_write("projects"."owner_id", "projects"."id"));--> statement-breakpoint
CREATE POLICY "task_dependencies_select" ON "task_dependencies" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from public.tasks where public.tasks.id = "task_dependencies"."task_id"));--> statement-breakpoint
CREATE POLICY "task_dependencies_insert" ON "task_dependencies" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (app.can_write("task_dependencies"."owner_id", null));--> statement-breakpoint
CREATE POLICY "task_dependencies_delete" ON "task_dependencies" AS PERMISSIVE FOR DELETE TO "authenticated" USING (app.can_write("task_dependencies"."owner_id", null));--> statement-breakpoint
CREATE POLICY "tasks_select" ON "tasks" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.can_read("tasks"."owner_id", "tasks"."project_id"));--> statement-breakpoint
CREATE POLICY "tasks_insert" ON "tasks" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (app.can_write("tasks"."owner_id", "tasks"."project_id"));--> statement-breakpoint
CREATE POLICY "tasks_update" ON "tasks" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (app.can_write("tasks"."owner_id", "tasks"."project_id")) WITH CHECK (app.can_write("tasks"."owner_id", "tasks"."project_id"));--> statement-breakpoint
CREATE POLICY "tasks_delete" ON "tasks" AS PERMISSIVE FOR DELETE TO "authenticated" USING (app.can_write("tasks"."owner_id", "tasks"."project_id"));--> statement-breakpoint
CREATE POLICY "captures_select" ON "captures" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.can_read("captures"."owner_id", null));--> statement-breakpoint
CREATE POLICY "captures_insert" ON "captures" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (app.can_write("captures"."owner_id", null));--> statement-breakpoint
CREATE POLICY "captures_update" ON "captures" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (app.can_write("captures"."owner_id", null)) WITH CHECK (app.can_write("captures"."owner_id", null));--> statement-breakpoint
CREATE POLICY "captures_delete" ON "captures" AS PERMISSIVE FOR DELETE TO "authenticated" USING (app.can_write("captures"."owner_id", null));--> statement-breakpoint
CREATE POLICY "audit_logs_select" ON "audit_logs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (app.can_read("audit_logs"."owner_id", null));--> statement-breakpoint
CREATE POLICY "audit_logs_insert" ON "audit_logs" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (app.can_write("audit_logs"."owner_id", null));--> statement-breakpoint
CREATE POLICY "domain_events_insert" ON "domain_events" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (app.can_write("domain_events"."owner_id", null));