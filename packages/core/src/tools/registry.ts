import { createCapture } from "./captures";
import { createProject, listProjects, updateProject } from "./projects";
import {
  addDependency,
  completeTask,
  createTask,
  listDependencies,
  listTasks,
  removeDependency,
  updateTask,
} from "./tasks";
import type { AnyTool } from "./types";

const all: AnyTool[] = [
  createTask,
  updateTask,
  completeTask,
  listTasks,
  addDependency,
  removeDependency,
  listDependencies,
  createProject,
  updateProject,
  listProjects,
  createCapture,
];

export const toolRegistry: ReadonlyMap<string, AnyTool> = new Map(all.map((t) => [t.name, t]));
