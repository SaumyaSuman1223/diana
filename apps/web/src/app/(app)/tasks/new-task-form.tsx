import type { Project } from "@diana/core";
import { ActionForm } from "@/components/action-form";
import { createTask } from "./actions";

/** Quick add: title plus the fields people actually set when capturing a task. */
export function NewTaskForm({ projects, projectId }: { projects: Project[]; projectId?: string }) {
  return (
    <ActionForm action={createTask} resetOnSuccess className="flex flex-wrap items-center gap-2">
      <label htmlFor={`new-title-${projectId ?? "any"}`} className="sr-only">
        New task
      </label>
      <input
        id={`new-title-${projectId ?? "any"}`}
        name="title"
        required
        maxLength={500}
        placeholder="Add a task…"
        className="field min-w-48 flex-1"
      />
      {projectId ? (
        <input type="hidden" name="projectId" value={projectId} />
      ) : (
        <>
          <label htmlFor="new-project" className="sr-only">
            Project
          </label>
          <select id="new-project" name="projectId" defaultValue="" className="field w-40">
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </>
      )}
      <label htmlFor={`new-due-${projectId ?? "any"}`} className="sr-only">
        Due date
      </label>
      <input id={`new-due-${projectId ?? "any"}`} type="date" name="dueDate" className="field w-40" />
      <label htmlFor={`new-est-${projectId ?? "any"}`} className="sr-only">
        Estimate in minutes
      </label>
      <input
        id={`new-est-${projectId ?? "any"}`}
        type="number"
        name="estimateMinutes"
        min={1}
        max={10000}
        placeholder="min"
        className="field w-20"
      />
      <label htmlFor={`new-prio-${projectId ?? "any"}`} className="sr-only">
        Priority
      </label>
      <select id={`new-prio-${projectId ?? "any"}`} name="priority" defaultValue="3" className="field w-28">
        <option value="1">P1 · urgent</option>
        <option value="2">P2 · high</option>
        <option value="3">P3 · normal</option>
        <option value="4">P4 · low</option>
      </select>
      <button type="submit" className="btn-primary">
        Add
      </button>
    </ActionForm>
  );
}
