import "server-only";

import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { z } from "zod";
import { generateText } from "./ai-providers";
import { makeFixtureScript, makeFixtureStoryboard } from "./fixtures";
import { AppError } from "./http";
import { getStorage } from "./storage";
import { projectInputSchema, scriptSchema, storyboardSchema, type Project, type ProjectInput, type Script, type Storyboard } from "./schema";
import { normalizeSceneDurations } from "./timing";

const mediaModels = {
  image: process.env.REELFLOW_IMAGE_MODEL || process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-flare",
  premiumImage: process.env.REELFLOW_PREMIUM_IMAGE_MODEL || process.env.OPENAI_PREMIUM_IMAGE_MODEL || "gpt-image-2.5-sunburst",
  tts: process.env.REELFLOW_TTS_MODEL || process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
};

function mediaClient() {
  const apiKey = process.env.REELFLOW_MEDIA_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AppError(503, "MISSING_MEDIA_CONFIGURATION", "Live image and voice generation need REELFLOW_MEDIA_API_KEY or OPENAI_API_KEY.");
  return new OpenAI({
    apiKey,
    baseURL: process.env.REELFLOW_MEDIA_BASE_URL,
    timeout: 120_000,
    maxRetries: 2,
  });
}

const planSchema = z.object({ script: scriptSchema, storyboard: storyboardSchema });

export function parsePlanOutput(output: string): { script: Script; storyboard: Storyboard } {
  const normalized = output.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let parsed: unknown;
  try { parsed = JSON.parse(normalized); } catch { throw new AppError(502, "INVALID_MODEL_OUTPUT", "The model returned an invalid plan. Try generating again."); }
  const plan = planSchema.safeParse(parsed);
  if (!plan.success) throw new AppError(502, "INVALID_MODEL_OUTPUT", "The model returned an incomplete plan. Try generating again.");
  return plan.data;
}

export async function generatePlan(inputValue: ProjectInput, demo: boolean): Promise<{ script: Script; storyboard: Storyboard }> {
  const input = projectInputSchema.parse(inputValue);
  if (demo) {
    const script = makeFixtureScript(input);
    return { script, storyboard: makeFixtureStoryboard(input, script) };
  }

  const schema = JSON.stringify(z.toJSONSchema(planSchema, { target: "draft-7" }));
  const output = await generateText("planning", `Create a complete short-form video plan. Keep narration natural and total scene duration exactly ${input.duration} seconds. Return only one JSON object matching this JSON Schema, without Markdown fences or commentary.\n\nJSON Schema: ${schema}\n\nProject: ${JSON.stringify(input)}`);
  const plan = parsePlanOutput(output);
  return { ...plan, storyboard: { scenes: normalizeSceneDurations(plan.storyboard.scenes, input.duration) } };
}

async function saveBase64(base64: string, extension: "png" | "mp3") {
  const contentType = extension === "png" ? "image/png" : "audio/mpeg";
  return getStorage().save(`generated/${randomUUID()}.${extension}`, Buffer.from(base64, "base64"), contentType);
}

export async function generateSceneImage(prompt: string, premium: boolean) {
  const result = await mediaClient().images.generate({
    model: premium ? mediaModels.premiumImage : mediaModels.image,
    prompt: `${prompt}. Vertical 9:16 composition, no text, no logos, safe margins for captions.`,
    size: "1024x1536",
    quality: premium ? "high" : "medium",
    output_format: "png",
  });
  const base64 = result.data?.[0]?.b64_json;
  if (!base64) throw new AppError(502, "IMAGE_GENERATION_FAILED", "A scene image could not be generated. You can retry that scene.");
  return saveBase64(base64, "png");
}

export async function generateVoice(project: Project) {
  if (!project.storyboard) throw new AppError(400, "MISSING_STORYBOARD", "Generate a storyboard before creating narration.");
  const input = project.storyboard.scenes.map((scene) => scene.narration).join("\n");
  const audio = await mediaClient().audio.speech.create({ model: mediaModels.tts, voice: project.voice, input, response_format: "mp3", instructions: `Speak in a ${project.tone} style with clear pacing for a vertical social video.` });
  return saveBase64(Buffer.from(await audio.arrayBuffer()).toString("base64"), "mp3");
}

export async function generateSectionText(project: Project, section: string, demo: boolean) {
  if (!project.script) throw new AppError(400, "MISSING_SCRIPT", "Generate a script before regenerating a section.");
  if (demo) {
    const fixture = makeFixtureScript(project);
    if (section === "hook") return fixture.hook;
    if (section === "outro") return fixture.outro;
    if (section === "callToAction") return fixture.callToAction;
    const index = Number(section.replace("mainPoints.", ""));
    return fixture.mainPoints[index] ?? fixture.mainPoints[0];
  }
  const text = await generateText("copy", `Rewrite only the ${section} section of this short-form video script. Return only the replacement text, no labels or quotation marks. Keep the same meaning, tone and approximate speaking length.\n\nProject: ${JSON.stringify({ topic: project.topic, audience: project.targetAudience, tone: project.tone, objective: project.objective, script: project.script })}`);
  if (text.length > 1200) throw new AppError(502, "INVALID_MODEL_OUTPUT", "The model returned an invalid script section. Try again.");
  return text;
}

export const configuredMediaModels = mediaModels;
