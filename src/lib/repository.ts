import "server-only";

import { eq, and } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import { projects } from "./db/schema";
import { projectInputSchema, projectPatchSchema, projectSchema, type Project, type ProjectInput } from "./schema";

function toProject(row: typeof projects.$inferSelect): Project {
  return projectSchema.parse({
    id: row.id,
    topic: row.topic,
    targetAudience: row.targetAudience,
    platform: row.platform,
    objective: row.objective,
    tone: row.tone,
    duration: row.duration,
    visualStyle: row.visualStyle,
    voice: row.voice,
    callToAction: row.callToAction ?? "",
    brandInstructions: row.brandInstructions ?? "",
    imageQuality: row.imageQuality ?? "standard",
    status: row.status ?? "draft",
    script: row.script ? JSON.parse(row.script) : undefined,
    storyboard: row.storyboard ? JSON.parse(row.storyboard) : undefined,
    assets: row.assets ? JSON.parse(row.assets) : [],
    renderJob: row.renderJob ? JSON.parse(row.renderJob) : undefined,
    error: row.error ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export async function listProjects(userId: string): Promise<Project[]> {
    const rows = db.select().from(projects).where(eq(projects.userId, userId)).all();
  return rows.map(toProject).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getProject(id: string, userId?: string): Promise<Project | undefined> {
    const condition = userId
    ? and(eq(projects.id, id), eq(projects.userId, userId))
    : eq(projects.id, id);
  const row = db.select().from(projects).where(condition).get();
  return row ? toProject(row) : undefined;
}

export async function createProject(input: ProjectInput, userId: string): Promise<Project> {
    const clean = projectInputSchema.parse(input);
  const now = new Date().toISOString();
  const id = randomUUID();
  db.insert(projects).values({
    id,
    userId,
    topic: clean.topic,
    targetAudience: clean.targetAudience,
    platform: clean.platform,
    objective: clean.objective,
    tone: clean.tone,
    duration: clean.duration,
    visualStyle: clean.visualStyle,
    voice: clean.voice,
    callToAction: clean.callToAction,
    brandInstructions: clean.brandInstructions,
    imageQuality: clean.imageQuality,
    status: "draft",
    assets: "[]",
    createdAt: now,
    updatedAt: now,
  }).run();
  return projectSchema.parse({ ...clean, id, status: "draft", assets: [], createdAt: now, updatedAt: now });
}

export async function updateProject(id: string, patch: unknown, userId?: string): Promise<Project | undefined> {
    const clean = projectPatchSchema.parse(patch);
  const existing = await getProject(id, userId);
  if (!existing) return undefined;
  const now = new Date().toISOString();
  const values: Record<string, unknown> = { updatedAt: now };
  for (const [key, value] of Object.entries(clean)) {
    if (value === undefined) continue;
    if (key === "script" || key === "storyboard" || key === "assets" || key === "renderJob") {
      values[key] = JSON.stringify(value);
    } else {
      values[key] = value;
    }
  }
  const condition = userId
    ? and(eq(projects.id, id), eq(projects.userId, userId))
    : eq(projects.id, id);
  db.update(projects).set(values).where(condition).run();
  return getProject(id, userId);
}

export async function deleteProject(id: string, userId?: string): Promise<boolean> {
    const condition = userId
    ? and(eq(projects.id, id), eq(projects.userId, userId))
    : eq(projects.id, id);
  const existing = db.select().from(projects).where(condition).get();
  if (!existing) return false;
  db.delete(projects).where(condition).run();
  return true;
}

export async function duplicateProject(id: string, userId?: string): Promise<Project | undefined> {
    const source = await getProject(id, userId);
  if (!source) return undefined;
  const now = new Date().toISOString();
  const newId = randomUUID();
  db.insert(projects).values({
    id: newId,
    userId: source.userId ?? userId ?? "anonymous",
    topic: `${source.topic} (copy)`,
    targetAudience: source.targetAudience,
    platform: source.platform,
    objective: source.objective,
    tone: source.tone,
    duration: source.duration,
    visualStyle: source.visualStyle,
    voice: source.voice,
    callToAction: source.callToAction,
    brandInstructions: source.brandInstructions,
    imageQuality: source.imageQuality,
    status: "draft",
    script: source.script ? JSON.stringify(source.script) : null,
    storyboard: source.storyboard ? JSON.stringify(source.storyboard) : null,
    assets: "[]",
    renderJob: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  }).run();
  return getProject(newId);
}
