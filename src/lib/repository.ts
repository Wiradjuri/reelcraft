import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { projectInputSchema, projectPatchSchema, projectSchema, type Project, type ProjectInput } from "./schema";

const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "projects.json");
let writeQueue = Promise.resolve();

async function readAll(): Promise<Project[]> {
  try {
    const parsed = JSON.parse(await fs.readFile(dataFile, "utf8"));
    return projectSchema.array().parse(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return [];
  }
}

async function writeAll(projects: Project[]): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    await fs.mkdir(dataDir, { recursive: true });
    const temp = `${dataFile}.${process.pid}.tmp`;
    await fs.writeFile(temp, `${JSON.stringify(projects, null, 2)}\n`, { mode: 0o600 });
    await fs.rename(temp, dataFile);
  });
  return writeQueue;
}

export async function listProjects(userId: string): Promise<Project[]> {
  return (await readAll()).filter((p) => p.userId === userId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getProject(id: string, userId?: string): Promise<Project | undefined> {
  const project = (await readAll()).find((p) => p.id === id);
  if (!project) return undefined;
  if (userId && project.userId !== userId) return undefined;
  return project;
}

export async function createProject(input: ProjectInput, userId: string): Promise<Project> {
  const clean = projectInputSchema.parse(input);
  const now = new Date().toISOString();
  const project = projectSchema.parse({ ...clean, id: randomUUID(), userId, status: "draft", assets: [], createdAt: now, updatedAt: now });
  const projects = await readAll();
  await writeAll([project, ...projects]);
  return project;
}

export async function updateProject(id: string, patch: unknown, userId?: string): Promise<Project | undefined> {
  const clean = projectPatchSchema.parse(patch);
  const projects = await readAll();
  const index = projects.findIndex((p) => p.id === id);
  if (index < 0) return undefined;
  if (userId && projects[index].userId !== userId) return undefined;
  projects[index] = projectSchema.parse({ ...projects[index], ...clean, id, updatedAt: new Date().toISOString() });
  await writeAll(projects);
  return projects[index];
}

export async function deleteProject(id: string, userId?: string): Promise<boolean> {
  const projects = await readAll();
  const project = projects.find((p) => p.id === id);
  if (!project) return false;
  if (userId && project.userId !== userId) return false;
  const next = projects.filter((p) => p.id !== id);
  await writeAll(next);
  return true;
}

export async function duplicateProject(id: string, userId?: string): Promise<Project | undefined> {
  const source = await getProject(id, userId);
  if (!source) return undefined;
  const now = new Date().toISOString();
  const copy = projectSchema.parse({ ...source, id: randomUUID(), topic: `${source.topic} (copy)`, status: "draft", renderJob: undefined, createdAt: now, updatedAt: now });
  const projects = await readAll();
  await writeAll([copy, ...projects]);
  return copy;
}
