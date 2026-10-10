import type { Project, Task } from "@diana/core";
import { Check, ChevronRight, RotateCcw, X } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { addDependency, completeTask, createTask, removeDependency, reopenTask, updateTask } from "./actions";

export interface TaskContext {
  projects: Map<string, Project>;
  allProjects: Project[];
  /** Every task in the current view, by id. */
  byId: Map<string, Task>;
  children: Map<string, Task[]>;
  /** taskId -> ids of tasks it waits for. */
  deps: Map<string, string[]>;
}

const statusLabels: Record<string, string> = {
  inbox: "Inbox",
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
};

export function TaskRow({ task, ctx, depth = 0 }: { task: Task; ctx: TaskContext; depth?: number }) {
  const done = task.status === "done";
  const project = task.projectId ? ctx.projects.get(task.projectId) : undefined;
  const waitingOn = (ctx.deps.get(task.id) ?? [])
    .map((id) => ctx.byId.get(id))
    .filter((t): t is Task => !!t && t.status !== "done" && t.status !== "cancelled");
  const subtasks = ctx.children.get(task.id) ?? [];
  const due = task.dueDate ?? (task.dueAt ? new Date(task.dueAt).toLocaleDateString("en-GB") : null);

  return (
    <li>
      <div className="flex items-center gap-3 px-3 py-2" style={{ paddingLeft: `${0.75 + depth * 1.5}rem` }}>
        <form action={done ? reopenTask : completeTask}>
          <input type="hidden" name="id" value={task.id} />
          <button
            type="submit"
            aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
            className={`flex size-5 items-center justify-center rounded-full border border-line hover:border-fg ${
              done ? "bg-surface-strong text-fg" : "text-transparent hover:text-muted"
            }`}
          >
            {done ? <RotateCcw aria-hidden size={11} /> : <Check aria-hidden size={12} />}
          </button>
        </form>
        <span className={`min-w-0 flex-1 truncate text-sm ${done ? "text-muted line-through" : ""}`}>
          {task.title}
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
          {waitingOn.length > 0 && <span title={waitingOn.map((t) => t.title).join(", ")}>waiting on {waitingOn.length}</span>}
          {task.status === "blocked" && <span className="text-danger">blocked</span>}
          {project && <span className="hidden max-w-32 truncate sm:inline">{project.title}</span>}
          {task.estimateMinutes && <span>{task.estimateMinutes}m</span>}
          {due && <span>due {due}</span>}
          <span className={task.priority <= 2 ? "font-medium text-accent" : undefined}>P{task.priority}</span>
        </span>
      </div>

      <details className="group px-3 pb-2" style={{ paddingLeft: `${0.75 + depth * 1.5 + 1.75}rem` }}>
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-xs text-muted hover:text-fg">
          <ChevronRight aria-hidden size={12} className="transition-transform group-open:rotate-90" />
          Details
        </summary>
        <div className="mt-2 flex flex-col gap-3 pb-1">
          <ActionForm action={updateTask} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={task.id} />
            <input type="hidden" name="dueDateWas" value={task.dueDate ?? ""} />
            <label className="sr-only" htmlFor={`t-${task.id}`}>
              Title
            </label>
            <input id={`t-${task.id}`} name="title" defaultValue={task.title} required maxLength={500} className="field min-w-48 flex-1" />
            {!done && (
              <>
                <label className="sr-only" htmlFor={`s-${task.id}`}>
                  Status
                </label>
                <select id={`s-${task.id}`} name="status" defaultValue={task.status} className="field w-36">
                  {["inbox", "todo", "in_progress", "blocked", "cancelled"].map((s) => (
                    <option key={s} value={s}>
                      {statusLabels[s]}
                    </option>
                  ))}
                </select>
              </>
            )}
            <label className="sr-only" htmlFor={`p-${task.id}`}>
              Priority
            </label>
            <select id={`p-${task.id}`} name="priority" defaultValue={task.priority} className="field w-24">
              {[1, 2, 3, 4].map((p) => (
                <option key={p} value={p}>
                  P{p}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor={`pr-${task.id}`}>
              Project
            </label>
            <select id={`pr-${task.id}`} name="projectId" defaultValue={task.projectId ?? ""} className="field w-40">
              <option value="">No project</option>
              {ctx.allProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor={`d-${task.id}`}>
              Due date
            </label>
            <input id={`d-${task.id}`} type="date" name="dueDate" defaultValue={task.dueDate ?? ""} className="field w-40" />
            <label className="sr-only" htmlFor={`e-${task.id}`}>
              Estimate in minutes
            </label>
            <input id={`e-${task.id}`} type="number" name="estimateMinutes" min={1} max={10000} defaultValue={task.estimateMinutes ?? ""} placeholder="min" className="field w-20" />
            <button type="submit" className="btn-primary">
              Save
            </button>
          </ActionForm>

          <Dependencies task={task} ctx={ctx} />

          {depth < 3 && (
            <ActionForm action={createTask} resetOnSuccess className="flex items-center gap-2">
              <input type="hidden" name="parentTaskId" value={task.id} />
              <label className="sr-only" htmlFor={`sub-${task.id}`}>
                New subtask
              </label>
              <input id={`sub-${task.id}`} name="title" required maxLength={500} placeholder="Add a subtask…" className="field flex-1" />
              <button type="submit" className="btn-primary">
                Add
              </button>
            </ActionForm>
          )}
        </div>
      </details>

      {subtasks.length > 0 && (
        <ul>
          {subtasks.map((child) => (
            <TaskRow key={child.id} task={child} ctx={ctx} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

function Dependencies({ task, ctx }: { task: Task; ctx: TaskContext }) {
  const current = ctx.deps.get(task.id) ?? [];
  const candidates = [...ctx.byId.values()].filter(
    (t) => t.id !== task.id && t.status !== "done" && t.status !== "cancelled" && !current.includes(t.id),
  );
  return (
    <div className="flex flex-col gap-2">
      {current.length > 0 && (
        <ul className="flex flex-wrap gap-2 text-xs">
          {current.map((id) => (
            <li key={id} className="flex items-center gap-1 rounded-md border border-line px-2 py-1">
              <span className="text-muted">waits for</span> {ctx.byId.get(id)?.title ?? "a finished task"}
              <form action={removeDependency}>
                <input type="hidden" name="taskId" value={task.id} />
                <input type="hidden" name="dependsOnTaskId" value={id} />
                <button type="submit" aria-label="Remove dependency" className="text-muted hover:text-fg">
                  <X aria-hidden size={12} />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      {candidates.length > 0 && (
        <ActionForm action={addDependency} className="flex items-center gap-2">
          <input type="hidden" name="taskId" value={task.id} />
          <label className="sr-only" htmlFor={`dep-${task.id}`}>
            Waits for
          </label>
          <select id={`dep-${task.id}`} name="dependsOnTaskId" defaultValue="" className="field min-w-48 flex-1">
            <option value="">Waits for…</option>
            {candidates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary">
            Link
          </button>
        </ActionForm>
      )}
    </div>
  );
}
