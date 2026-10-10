import "server-only";
import { revalidatePath } from "next/cache";
import { runTool } from "./tools";

/** Result of a form action. `ok` changes on every success so forms can reset themselves. */
export type ActionState = { error?: string; ok?: number };

/** Pages whose data comes from tasks or projects. */
const dataPaths = ["/today", "/tasks", "/projects"];

/** Run a tool for a form submit and translate the outcome into something a form can show. */
export async function submit(name: string, input: unknown): Promise<ActionState> {
  const out = await runTool(name, input);
  switch (out.status) {
    case "ok":
      for (const path of dataPaths) revalidatePath(path);
      return { ok: Date.now() };
    case "invalid_input":
      return { error: out.issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join("; ") };
    case "error":
      return { error: out.message };
    case "needs_approval":
      return { error: "This action needs approval." };
  }
}

/** Trimmed text field, or undefined when empty. */
export function text(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

/** Text field where an empty value means "clear it". */
export function nullableText(form: FormData, key: string): string | null {
  return text(form, key) ?? null;
}

export function int(form: FormData, key: string): number | undefined {
  const value = text(form, key);
  return value === undefined ? undefined : Number(value);
}
