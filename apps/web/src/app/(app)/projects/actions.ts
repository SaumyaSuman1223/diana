"use server";

import { nullableText, submit, text, type ActionState } from "@/lib/form";

export async function createProject(_prev: ActionState, form: FormData): Promise<ActionState> {
  return submit("projects.create", {
    title: form.get("title"),
    objective: text(form, "objective"),
    dueDate: text(form, "dueDate"),
  });
}

export async function updateProject(_prev: ActionState, form: FormData): Promise<ActionState> {
  return submit("projects.update", {
    id: form.get("id"),
    title: form.get("title"),
    objective: nullableText(form, "objective"),
    status: text(form, "status"),
    dueDate: nullableText(form, "dueDate"),
  });
}
