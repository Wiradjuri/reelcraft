import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { projectInputSchema, projectPatchSchema, projectSchema, type Project, type ProjectInput } from "./schema";
import { tursoConfigured, tursoQuery } from "./turso";

/**
 * Projects are stored as one JSON document per row in Turso (production) or in
 * data/projects.json (local dev/tests when Turso isn't configured). The JSON
 * document is the source of truth; user_id/updated_at are indexed columns.
 */
interface Store {
  list(userId: string): Promise<Project[]>;
  get(id: string): Promise<Project | undefined>;
  put(project: Project): Promise<void>;
  remove(id: string): Promise<boolean>;
}

const tursoStore: Store = {
  async list(userId) {
    const rows = await tursoQuery("SELECT data FROM reel_projects WHERE user_id = ? ORDER BY updated_at DESC", [userId]);
    return rows.map((row) => projectSchema.parse(JSON.parse(String(row.data))));
  },
  async get(id) {
    const rows = await tursoQuery("SELECT data FROM reel_projects WHERE id = ?", [id]);
    return rows[0] ? projectSchema.parse(JSON.parse(String(rows[0].data))) : undefined;
  },
  async put(project) {
    await tursoQuery(
      "INSERT INTO reel_projects (id, user_id, updated_at, data) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET user_id = excluded.user_id, updated_at = excluded.updated_at, data = excluded.data",
      [project.id, project.userId, project.updatedAt, JSON.stringify(project)],
    );
  },
  async remove(id) {
    const rows = await tursoQuery("DELETE FROM reel_projects WHERE id = ? RETURNING id", [id]);
    return rows.length > 0;
  },
};

const dataFile = path.join(process.cwd(), "data", "projects.json");
let writeQueue = Promise.resolve();
async function readAll(): Promise<Project[]> {
  try { return projectSchema.array().parse(JSON.parse(await fs.readFile(dataFile, "utf8"))); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; return []; }
}
async function writeAll(projects: Project[]) {
  writeQueue = writeQueue.then(async () => {
    await fs.mkdir(path.dirname(dataFile), { recursive: true });
    const temp = `${dataFile}.${process.pid}.tmp`;
    await fs.writeFile(temp, `${JSON.stringify(projects, null, 2)}\n`, { mode: 0o600 });
    await fs.rename(temp, dataFile);
  });
  return writeQueue;
}
const fileStore: Store = {
  async list(userId) { return (await readAll()).filter((p) => p.userId === userId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
  async get(id) { return (await readAll()).find((p) => p.id === id); },
  async put(project) { const all = await readAll(); const i = all.findIndex((p) => p.id === project.id); if (i < 0) all.unshift(project); else all[i] = project; await writeAll(all); },
  async remove(id) { const all = await readAll(); const next = all.filter((p) => p.id !== id); if (next.length === all.length) return false; await writeAll(next); return true; },
};

const store: Store = tursoConfigured() ? tursoStore : fileStore;

function owned(project: Project | undefined, userId?: string) {
  return project && (!userId || project.userId === userId) ? project : undefined;
}

export async function listProjects(userId: string): Promise<Project[]> {
  return store.list(userId);
}

export async function getProject(id: string, userId?: string): Promise<Project | undefined> {
  return owned(await store.get(id), userId);
}

export async function createProject(input: ProjectInput, userId: string): Promise<Project> {
  const clean = projectInputSchema.parse(input);
  const now = new Date().toISOString();
  const project = projectSchema.parse({ ...clean, id: randomUUID(), userId, status: "draft", assets: [], createdAt: now, updatedAt: now });
  await store.put(project);
  return project;
}

export async function updateProject(id: string, patch: unknown, userId?: string): Promise<Project | undefined> {
  const clean = projectPatchSchema.parse(patch);
  const existing = owned(await store.get(id), userId);
  if (!existing) return undefined;
  const updated = projectSchema.parse({ ...existing, ...clean, id, userId: existing.userId, updatedAt: new Date().toISOString() });
  await store.put(updated);
  return updated;
}

export async function deleteProject(id: string, userId?: string): Promise<boolean> {
  if (!owned(await store.get(id), userId)) return false;
  return store.remove(id);
}

export async function duplicateProject(id: string, userId?: string): Promise<Project | undefined> {
  const source = owned(await store.get(id), userId);
  if (!source) return undefined;
  const now = new Date().toISOString();
  const copy = projectSchema.parse({ ...source, id: randomUUID(), topic: `${source.topic} (copy)`, status: "draft", renderJob: undefined, createdAt: now, updatedAt: now });
  await store.put(copy);
  return copy;
}
