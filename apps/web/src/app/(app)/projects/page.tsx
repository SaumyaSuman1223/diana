import type { Project, Task } from "@diana/core";
import { Check, ChevronRight } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { runTool } from "@/lib/tools";
import { completeTask } from "../tasks/actions";
import { NewTaskForm } from "../tasks/new-task-form";
import { createProject, updateProject } from "./actions";

export default async function ProjectsPage() {
  const [projectsOut, tasksOut] = await Promise.all([
    runTool<Project[]>("projects.list", { status: ["active", "paused", "completed"] }),
    runTool<Task[]>("tasks.list", { status: "open", limit: 500 }),
  ]);
  const projects = projectsOut.status === "ok" ? projectsOut.data : [];
  const tasks = tasksOut.status === "ok" ? tasksOut.data : [];
  const byProject = new Map<string, Task[]>();
  for (const task of tasks) {
    if (task.projectId) byProject.set(task.projectId, [...(byProject.get(task.projectId) ?? []), task]);
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>

      <ActionForm action={createProject} resetOnSuccess className="flex flex-wrap items-center gap-2">
        <label htmlFor="new-project-title" className="sr-only">
          New project
        </label>
        <input id="new-project-title" name="title" required maxLength={200} placeholder="New project…" className="field min-w-48 flex-1" />
        <label htmlFor="new-project-due" className="sr-only">
          Due date
        </label>
        <input id="new-project-due" type="date" name="dueDate" className="field w-40" />
        <button type="submit" className="btn-primary">
          Create
        </button>
      </ActionForm>

      {projects.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
          No projects yet. Create one above.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} tasks={byProject.get(project.id) ?? []} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project, tasks }: { project: Project; tasks: Task[] }) {
  return (
    <section aria-labelledby={`p-${project.id}`} className="rounded-md border border-line">
      <header className="flex items-baseline justify-between gap-3 px-3 py-2">
        <h2 id={`p-${project.id}`} className="text-base font-medium">
          {project.title}
        </h2>
        <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
          {project.status !== "active" && <span>{project.status}</span>}
          {project.dueDate && <span>due {project.dueDate}</span>}
          <span>{tasks.length} open</span>
        </span>
      </header>
      {project.objective && <p className="px-3 pb-2 text-sm text-muted">{project.objective}</p>}

      {tasks.length > 0 && (
        <ul className="divide-y divide-line border-t border-line">
          {tasks.map((task) => (
            <li key={task.id} className="flex items-center gap-3 px-3 py-2">
              <form action={completeTask}>
                <input type="hidden" name="id" value={task.id} />
                <button
                  type="submit"
                  aria-label={`Complete ${task.title}`}
                  className="flex size-5 items-center justify-center rounded-full border border-line text-transparent hover:border-fg hover:text-muted"
                >
                  <Check aria-hidden size={12} />
                </button>
              </form>
              <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>
              <span className="shrink-0 text-xs text-muted">
                {task.dueDate && <span className="mr-2">due {task.dueDate}</span>}P{task.priority}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-line px-3 py-2">
        <NewTaskForm projects={[]} projectId={project.id} />
      </div>

      <details className="group border-t border-line px-3 py-2">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-xs text-muted hover:text-fg">
          <ChevronRight aria-hidden size={12} className="transition-transform group-open:rotate-90" />
          Edit project
        </summary>
        <ActionForm action={updateProject} className="mt-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={project.id} />
          <label className="sr-only" htmlFor={`pt-${project.id}`}>
            Title
          </label>
          <input id={`pt-${project.id}`} name="title" defaultValue={project.title} required maxLength={200} className="field min-w-48 flex-1" />
          <label className="sr-only" htmlFor={`ps-${project.id}`}>
            Status
          </label>
          <select id={`ps-${project.id}`} name="status" defaultValue={project.status} className="field w-36">
            {["active", "paused", "completed", "archived"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor={`pd-${project.id}`}>
            Due date
          </label>
          <input id={`pd-${project.id}`} type="date" name="dueDate" defaultValue={project.dueDate ?? ""} className="field w-40" />
          <label className="sr-only" htmlFor={`po-${project.id}`}>
            Objective
          </label>
          <textarea id={`po-${project.id}`} name="objective" defaultValue={project.objective ?? ""} rows={2} maxLength={5000} placeholder="Objective" className="field w-full" />
          <button type="submit" className="btn-primary">
            Save
          </button>
        </ActionForm>
      </details>
    </section>
  );
}
