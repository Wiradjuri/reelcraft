import { randomUUID } from "node:crypto";
import { apiError, assertProjectId, AppError, throttle } from "@/lib/http";
import { requireUserId } from "@/lib/session";
import { LocalRemotionRenderer } from "@/lib/renderer";
import { getProject, updateProject } from "@/lib/repository";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  let projectId = "";
  try {
    const userId = await requireUserId();
    const body = await request.json(); projectId = String(body.projectId ?? ""); assertProjectId(projectId); throttle(`render:${projectId}`, 3, 300_000);
    const project = await getProject(projectId, userId);
    if (!project) throw new AppError(404, "NOT_FOUND", "Project not found.");
    const now = new Date().toISOString();
    const job = { id: randomUUID(), status: "rendering" as const, progress: 1, createdAt: now, updatedAt: now };
    await updateProject(projectId, { status: "rendering", renderJob: job, error: undefined }, userId);
    const completed = await new LocalRemotionRenderer().render({ ...project, renderJob: job }, async (progress) => {
      await updateProject(projectId, { renderJob: { ...job, status: "rendering", progress, updatedAt: new Date().toISOString() } }, userId);
    });
    const saved = await updateProject(projectId, { status: "complete", renderJob: completed }, userId);
    return Response.json(saved);
  } catch (error) {
    if (projectId) {
      const existing = await getProject(projectId).catch(() => undefined);
      const now = new Date().toISOString();
      await updateProject(projectId, { status: "failed", error: "The render failed. Your project is safe and can be retried.", renderJob: { id: existing?.renderJob?.id ?? randomUUID(), status: "failed", progress: existing?.renderJob?.progress ?? 0, error: "Render failed", createdAt: existing?.renderJob?.createdAt ?? now, updatedAt: now } }).catch(() => undefined);
    }
    return apiError(error);
  }
}

