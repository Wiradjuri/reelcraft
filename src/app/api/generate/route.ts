import { randomUUID } from "node:crypto";
import { apiError, assertProjectId, AppError, throttle } from "@/lib/http";
import { requireUserId } from "@/lib/session";
import { generatePlan, generateSceneImage, generateSectionText, generateVoice } from "@/lib/openai";
import { getProject, updateProject } from "@/lib/repository";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  let projectId = "";
  try {
    const userId = await requireUserId();
    const body = await request.json();
    projectId = String(body.projectId ?? ""); assertProjectId(projectId); throttle(`generate:${projectId}`, 4, 60_000);
    const project = await getProject(projectId, userId);
    if (!project) throw new AppError(404, "NOT_FOUND", "Project not found.");
    const demo = body.demo !== false;
    if (body.action === "image") {
      if (!project.storyboard) throw new AppError(400, "MISSING_STORYBOARD", "Generate a storyboard before generating scene images.");
      const index = project.storyboard.scenes.findIndex((scene) => scene.id === body.sceneId);
      if (index < 0) throw new AppError(404, "SCENE_NOT_FOUND", "Scene not found.");
      if (demo) return Response.json({ project, warnings: ["Demo scenes use deterministic gradient artwork."], demo });
      const imageUrl = await generateSceneImage(project.storyboard.scenes[index].visualPrompt, project.imageQuality === "premium");
      const scenes = project.storyboard.scenes.map((scene, sceneIndex) => sceneIndex === index ? { ...scene, imageUrl } : scene);
      const saved = await updateProject(projectId, { storyboard: { scenes }, assets: [...project.assets, { id: randomUUID(), kind: "image", url: imageUrl, status: "ready" }] }, userId);
      return Response.json({ project: saved, warnings: [], demo });
    }
    if (body.action === "section") {
      const section = String(body.section ?? "");
      if (!/^(hook|outro|callToAction|mainPoints\.\d+)$/.test(section)) throw new AppError(400, "INVALID_SECTION", "Script section is invalid.");
      const text = await generateSectionText(project, section, demo);
      const script = { ...project.script! };
      if (section.startsWith("mainPoints.")) {
        const index = Number(section.split(".")[1]);
        script.mainPoints = script.mainPoints.map((point, pointIndex) => pointIndex === index ? text : point);
      } else script[section as "hook" | "outro" | "callToAction"] = text;
      const saved = await updateProject(projectId, { script }, userId);
      return Response.json({ project: saved, warnings: [], demo });
    }
    await updateProject(projectId, { status: "generating", error: undefined }, userId);
    const { script, storyboard } = await generatePlan(project, demo);
    const warnings: string[] = [];
    const assets = [...project.assets];
    if (!demo) {
      for (const scene of storyboard.scenes) {
        try {
          scene.imageUrl = await generateSceneImage(scene.visualPrompt, project.imageQuality === "premium");
          assets.push({ id: randomUUID(), kind: "image", url: scene.imageUrl, status: "ready" });
        } catch {
          warnings.push(`Image for ${scene.id} needs a retry.`);
        }
      }
      try {
        const voiceProject = { ...project, script, storyboard };
        const voiceUrl = await generateVoice(voiceProject);
        assets.push({ id: randomUUID(), kind: "voice", url: voiceUrl, status: "ready" });
      } catch {
        warnings.push("Voice-over needs a retry.");
      }
    }
    const saved = await updateProject(projectId, { status: "ready", script, storyboard, assets, error: warnings.length ? warnings.join(" ") : undefined }, userId);
    return Response.json({ project: saved, warnings, demo });
  } catch (error) {
    if (projectId) await updateProject(projectId, { status: "failed", error: "Generation stopped. Your saved content is safe; try again when ready." }).catch(() => undefined);
    return apiError(error);
  }
}
