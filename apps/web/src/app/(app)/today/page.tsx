import type { Task } from "@diana/core";
import { Check } from "lucide-react";
import { runTool } from "@/lib/tools";
import { completeTask } from "./actions";
import { AddTaskForm } from "./add-task-form";

export default async function TodayPage() {
  const out = await runTool<Task[]>("tasks.list", { status: "open" });
  const tasks = out.status === "ok" ? out.data : [];
  const today = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <p className="text-sm text-muted">{today}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
      </header>

      <AddTaskForm />

      <section aria-labelledby="open-tasks">
        <h2 id="open-tasks" className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Open tasks · {tasks.length}
        </h2>
        {tasks.length === 0 ? (
          <p className="rounded-md border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
            Nothing open. Add a task above, or press Ctrl K.
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-md border border-line">
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
                <TaskMeta task={task} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TaskMeta({ task }: { task: Task }) {
  const due = task.dueDate ?? (task.dueAt ? new Date(task.dueAt).toLocaleDateString("en-GB") : null);
  return (
    <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
      {due && <span>due {due}</span>}
      <span className={task.priority <= 2 ? "font-medium text-accent" : undefined}>P{task.priority}</span>
    </span>
  );
}
