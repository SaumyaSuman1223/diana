"use server";

import { int, nullableText, submit, text, type ActionState } from "@/lib/form";

export async function createTask(_prev: ActionState, form: FormData): Promise<ActionState> {
  return submit("tasks.create", {
    title: form.get("title"),
    priority: int(form, "priority") ?? 3,
    projectId: text(form, "projectId"),
    parentTaskId: text(form, "parentTaskId"),
    dueDate: text(form, "dueDate"),
    estimateMinutes: int(form, "estimateMinutes"),
    status: "todo",
  });
}

export async function updateTask(_prev: ActionState, form: FormData): Promise<ActionState> {
  // Tasks with an exact deadline (dueAt) show no date here; only send a date the user changed.
  const dueDate = nullableText(form, "dueDate");
  const dueDateChanged = dueDate !== nullableText(form, "dueDateWas");
  return submit("tasks.update", {
    id: form.get("id"),
    title: form.get("title"),
    status: text(form, "status"),
    priority: int(form, "priority"),
    estimateMinutes: int(form, "estimateMinutes") ?? null,
    projectId: nullableText(form, "projectId"),
    ...(dueDateChanged ? { dueDate } : {}),
  });
}

export async function completeTask(form: FormData) {
  await submit("tasks.complete", { id: form.get("id") });
}

export async function reopenTask(form: FormData) {
  await submit("tasks.update", { id: form.get("id"), status: "todo" });
}

export async function addDependency(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!text(form, "dependsOnTaskId")) return { error: "Pick a task." };
  return submit("tasks.addDependency", {
    taskId: form.get("taskId"),
    dependsOnTaskId: form.get("dependsOnTaskId"),
  });
}

export async function removeDependency(form: FormData) {
  await submit("tasks.removeDependency", {
    taskId: form.get("taskId"),
    dependsOnTaskId: form.get("dependsOnTaskId"),
  });
}
