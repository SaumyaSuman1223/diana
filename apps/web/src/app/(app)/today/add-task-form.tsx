"use client";

import { useActionState } from "react";
import { addTask, type AddTaskState } from "./actions";

export function AddTaskForm() {
  const [state, action, pending] = useActionState(addTask, { key: 0 } as AddTaskState);
  return (
    <form key={state.key} action={action} className="flex flex-col gap-2 sm:flex-row">
      <label htmlFor="new-task" className="sr-only">
        New task
      </label>
      <input id="new-task" name="title" required maxLength={500} placeholder="Add a task…" className="field flex-1" />
      <label htmlFor="new-task-priority" className="sr-only">
        Priority
      </label>
      <select id="new-task-priority" name="priority" defaultValue="3" className="field sm:w-28">
        <option value="1">P1 · urgent</option>
        <option value="2">P2 · high</option>
        <option value="3">P3 · normal</option>
        <option value="4">P4 · low</option>
      </select>
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Adding…" : "Add"}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-danger sm:self-center">
          {state.error}
        </p>
      )}
    </form>
  );
}
