import { createCapture } from "./captures";
import { createProject, listProjects } from "./projects";
import { completeTask, createTask, listTasks } from "./tasks";
import type { AnyTool } from "./types";

const all: AnyTool[] = [createTask, completeTask, listTasks, createProject, listProjects, createCapture];

export const toolRegistry: ReadonlyMap<string, AnyTool> = new Map(all.map((t) => [t.name, t]));
