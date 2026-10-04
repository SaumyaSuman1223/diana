"use server";

import { revalidatePath } from "next/cache";
import { runTool } from "@/lib/tools";

export type AddTaskState = { error?: string; key: number };

export async function addTask(prev: AddTaskState, form: FormData): Promise<AddTaskState> {
  const out = await runTool("tasks.create", {
    title: form.get("title"),
    priority: Number(form.get("priority") ?? 3),
    status: "todo",
  });
  if (out.status === "invalid_input") return { key: prev.key, error: "Give the task a title." };
  if (out.status !== "ok") return { key: prev.key, error: "Could not save the task. Try again." };
  revalidatePath("/today");
  // A new key remounts the form, clearing the input.
  return { key: prev.key + 1 };
}

export async function completeTask(form: FormData) {
  await runTool("tasks.complete", { id: form.get("id") });
  revalidatePath("/today");
}
