import { createProject, listProjects } from "@/lib/repository";
import { apiError, throttle } from "@/lib/http";
import { requireUserId } from "@/lib/session";
import { projectInputSchema } from "@/lib/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await requireUserId();
    return Response.json(await listProjects(userId));
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    throttle("projects:create");
    return Response.json(await createProject(projectInputSchema.parse(await request.json()), userId), { status: 201 });
  } catch (error) { return apiError(error); }
}

