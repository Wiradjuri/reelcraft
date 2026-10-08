import { apiError, assertProjectId, AppError, throttle } from "@/lib/http";
import { requireUserId } from "@/lib/session";
import { deleteProject, duplicateProject, getProject, updateProject } from "@/lib/repository";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  try {
    const userId = await requireUserId();
    const { id } = await context.params; assertProjectId(id);
    const project = await getProject(id, userId);
    if (!project) throw new AppError(404, "NOT_FOUND", "Project not found.");
    return Response.json(project);
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const userId = await requireUserId();
    const { id } = await context.params; assertProjectId(id); throttle(`projects:update:${id}`, 30);
    const project = await updateProject(id, await request.json(), userId);
    if (!project) throw new AppError(404, "NOT_FOUND", "Project not found.");
    return Response.json(project);
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request, context: Context) {
  try {
    const userId = await requireUserId();
    const { id } = await context.params; assertProjectId(id); throttle(`projects:action:${id}`);
    const body = await request.json();
    if (body.action !== "duplicate") throw new AppError(400, "INVALID_ACTION", "Unsupported project action.");
    const project = await duplicateProject(id, userId);
    if (!project) throw new AppError(404, "NOT_FOUND", "Project not found.");
    return Response.json(project, { status: 201 });
  } catch (error) { return apiError(error); }
}

export async function DELETE(_: Request, context: Context) {
  try {
    const userId = await requireUserId();
    const { id } = await context.params; assertProjectId(id);
    if (!(await deleteProject(id, userId))) throw new AppError(404, "NOT_FOUND", "Project not found.");
    return new Response(null, { status: 204 });
  } catch (error) { return apiError(error); }
}

