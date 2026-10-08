import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { z } from "zod";
import { makeFixtureScript, makeFixtureStoryboard } from "./fixtures";
import { AppError } from "./http";
import { projectInputSchema, scriptSchema, storyboardSchema, type Project, type ProjectInput, type Script, type Storyboard } from "./schema";
import { normalizeSceneDurations } from "./timing";

const models = {
  planning: process.env.OPENAI_PLANNING_MODEL || "gpt-6.1-sol",
  copy: process.env.OPENAI_COPY_MODEL || "gpt-6-luna",
  image: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.5-flare",
  premiumImage: process.env.OPENAI_PREMIUM_IMAGE_MODEL || "gpt-image-2.5-sunburst",
  tts: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
};

function client() {
  if (!process.env.OPENAI_API_KEY) throw new AppError(503, "MISSING_CONFIGURATION", "Live generation needs OPENAI_API_KEY. Switch to demo mode or configure the server environment.");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 120_000, maxRetries: 2 });
}

const planSchema = z.object({ script: scriptSchema, storyboard: storyboardSchema });

export async function generatePlan(inputValue: ProjectInput, demo: boolean): Promise<{ script: Script; storyboard: Storyboard }> {
  const input = projectInputSchema.parse(inputValue);
  if (demo) {
    const script = makeFixtureScript(input);
    return { script, storyboard: makeFixtureStoryboard(input, script) };
  }

  const response = await client().responses.create({
    model: models.planning,
    input: `Create a complete short-form video plan. Keep narration natural and total scene duration exactly ${input.duration} seconds.\n\nProject: ${JSON.stringify(input)}`,
    text: {
      format: {
        type: "json_schema",
        name: "reelflow_plan",
        strict: true,
        schema: z.toJSONSchema(planSchema, { target: "draft-7" }),
      },
    },
  });
  if (!response.output_text) throw new AppError(502, "INVALID_MODEL_OUTPUT", "The model returned no usable plan. Try generating again.");
  let parsed: unknown;
  try { parsed = JSON.parse(response.output_text); } catch { throw new AppError(502, "INVALID_MODEL_OUTPUT", "The model returned an invalid plan. Try generating again."); }
  const plan = planSchema.safeParse(parsed);
  if (!plan.success) throw new AppError(502, "INVALID_MODEL_OUTPUT", "The model returned an incomplete plan. Try generating again.");
  return { ...plan.data, storyboard: { scenes: normalizeSceneDurations(plan.data.storyboard.scenes, input.duration) } };
}

async function saveBase64(base64: string, extension: "png" | "mp3") {
  const name = `${randomUUID()}.${extension}`;
  const directory = path.join(process.cwd(), "public", "generated");
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, name), Buffer.from(base64, "base64"), { mode: 0o600 });
  return `/generated/${name}`;
}

export async function generateSceneImage(prompt: string, premium: boolean) {
  const result = await client().images.generate({
    model: premium ? models.premiumImage : models.image,
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
  const audio = await client().audio.speech.create({ model: models.tts, voice: project.voice, input, response_format: "mp3", instructions: `Speak in a ${project.tone} style with clear pacing for a vertical social video.` });
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
  const response = await client().responses.create({
    model: models.copy,
    input: `Rewrite only the ${section} section of this short-form video script. Return only the replacement text, no labels or quotation marks. Keep the same meaning, tone and approximate speaking length.\n\nProject: ${JSON.stringify({ topic: project.topic, audience: project.targetAudience, tone: project.tone, objective: project.objective, script: project.script })}`,
  });
  const text = response.output_text.trim();
  if (!text || text.length > 1200) throw new AppError(502, "INVALID_MODEL_OUTPUT", "The model returned an invalid script section. Try again.");
  return text;
}

export const configuredModels = models;
