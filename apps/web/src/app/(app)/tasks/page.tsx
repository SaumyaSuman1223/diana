import type { Project, Task } from "@diana/core";
import Link from "next/link";
import { runTool } from "@/lib/tools";
import { NewTaskForm } from "./new-task-form";
import { TaskRow, type TaskContext } from "./task-row";

type Dependency = { taskId: string; dependsOnTaskId: string };

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const show = (await searchParams).show === "done" ? "done" : "open";
  const [tasksOut, projectsOut, depsOut] = await Promise.all([
    runTool<Task[]>("tasks.list", { status: show, limit: 500 }),
    runTool<Project[]>("projects.list", { status: ["active", "paused"] }),
    runTool<Dependency[]>("tasks.listDependencies", {}),
  ]);
  const tasks = tasksOut.status === "ok" ? tasksOut.data : [];
  const projects = projectsOut.status === "ok" ? projectsOut.data : [];
  const links = depsOut.status === "ok" ? depsOut.data : [];

  const byId = new Map(tasks.map((t) => [t.id, t]));
  const children = new Map<string, Task[]>();
  const roots: Task[] = [];
  for (const task of tasks) {
    // A subtask whose parent is not in this view (e.g. parent already done) stands on its own.
    const parent = task.parentTaskId ? byId.get(task.parentTaskId) : undefined;
    if (parent) children.set(parent.id, [...(children.get(parent.id) ?? []), task]);
    else roots.push(task);
  }
  const deps = new Map<string, string[]>();
  for (const l of links) deps.set(l.taskId, [...(deps.get(l.taskId) ?? []), l.dependsOnTaskId]);

  const ctx: TaskContext = {
    projects: new Map(projects.map((p) => [p.id, p])),
    allProjects: projects,
    byId,
    children,
    deps,
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="flex items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        <nav aria-label="Filter" className="flex gap-1 text-sm">
          {(["open", "done"] as const).map((value) => (
            <Link
              key={value}
              href={value === "open" ? "/tasks" : "/tasks?show=done"}
              aria-current={show === value ? "page" : undefined}
              className={`rounded-md px-3 py-1 ${show === value ? "bg-surface-strong font-medium" : "text-muted hover:text-fg"}`}
            >
              {value === "open" ? "Open" : "Done"}
            </Link>
          ))}
        </nav>
      </header>

      {show === "open" && <NewTaskForm projects={projects} />}

      <section aria-label={`${show} tasks`}>
        {roots.length === 0 ? (
          <p className="rounded-md border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
            {show === "open" ? "Nothing open. Add a task above." : "Nothing completed yet."}
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-md border border-line">
            {roots.map((task) => (
              <TaskRow key={task.id} task={task} ctx={ctx} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
