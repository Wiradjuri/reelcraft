import { z } from "zod";

export const platformSchema = z.enum(["Instagram Reels", "TikTok", "YouTube Shorts"]);
export const durationSchema = z.union([z.literal(30), z.literal(45), z.literal(60)]);
export const projectStatusSchema = z.enum([
  "draft",
  "generating",
  "ready",
  "rendering",
  "complete",
  "failed",
]);

export const scriptSchema = z.object({
  hook: z.string().min(1).max(600),
  mainPoints: z.array(z.string().min(1).max(1200)).min(1).max(8),
  outro: z.string().min(1).max(600),
  callToAction: z.string().max(600),
  estimatedDuration: z.number().positive().max(120),
});

export const sceneSchema = z.object({
  id: z.string().min(1).max(80),
  narration: z.string().min(1).max(1800),
  caption: z.string().min(1).max(240),
  visualPrompt: z.string().min(1).max(1800),
  duration: z.number().min(1).max(20),
  imageUrl: z.string().max(2000).optional(),
});

export const storyboardSchema = z.object({
  scenes: z.array(sceneSchema).min(1).max(16),
});

export const generatedAssetSchema = z.object({
  id: z.string(),
  kind: z.enum(["image", "voice", "music", "video"]),
  url: z.string(),
  status: z.enum(["ready", "failed"]),
  error: z.string().optional(),
});

export const renderJobSchema = z.object({
  id: z.string(),
  status: z.enum(["queued", "rendering", "complete", "failed"]),
  progress: z.number().min(0).max(100),
  outputUrl: z.string().optional(),
  error: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const projectInputSchema = z.object({
  topic: z.string().trim().min(3).max(500),
  targetAudience: z.string().trim().min(2).max(300),
  platform: platformSchema,
  objective: z.string().trim().min(2).max(300),
  tone: z.string().trim().min(2).max(120),
  duration: durationSchema,
  visualStyle: z.string().trim().min(2).max(300),
  voice: z.enum(["alloy", "coral", "nova", "sage", "shimmer", "verse"]),
  callToAction: z.string().trim().max(500),
  brandInstructions: z.string().trim().max(1500),
  imageQuality: z.enum(["standard", "premium"]).default("standard"),
});

export const projectSchema = projectInputSchema.extend({
  id: z.string().uuid(),
  userId: z.string().default("anonymous"),
  status: projectStatusSchema,
  script: scriptSchema.optional(),
  storyboard: storyboardSchema.optional(),
  assets: z.array(generatedAssetSchema).default([]),
  renderJob: renderJobSchema.optional(),
  error: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const projectPatchSchema = projectInputSchema.partial().extend({
  status: projectStatusSchema.optional(),
  script: scriptSchema.optional(),
  storyboard: storyboardSchema.optional(),
  assets: z.array(generatedAssetSchema).optional(),
  renderJob: renderJobSchema.optional(),
  error: z.string().optional(),
});

export type Script = z.infer<typeof scriptSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type Storyboard = z.infer<typeof storyboardSchema>;
export type ProjectInput = z.infer<typeof projectInputSchema>;
export type Project = z.infer<typeof projectSchema>;
export type RenderJob = z.infer<typeof renderJobSchema>;

