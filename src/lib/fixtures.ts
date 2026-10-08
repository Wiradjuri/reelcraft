import type { Project, ProjectInput, Script, Storyboard } from "./schema";
import { normalizeSceneDurations } from "./timing";

export const demoInput: ProjectInput = {
  topic: "Why consistency beats virality for small brands",
  targetAudience: "Solo founders and small business owners",
  platform: "Instagram Reels",
  objective: "Educate and build trust",
  tone: "Confident, warm and practical",
  duration: 30,
  visualStyle: "Editorial collage, electric violet accents, cinematic photography",
  voice: "coral",
  callToAction: "Save this and build your repeatable content rhythm.",
  brandInstructions: "Use plain English and avoid hype.",
  imageQuality: "standard",
};

export function makeFixtureScript(input: ProjectInput): Script {
  return {
    hook: "The post that changes your business probably won't be your most viral one.",
    mainPoints: [
      `For ${input.targetAudience.toLowerCase()}, consistency creates recognition before it creates reach.`,
      "A repeatable message compounds: people remember what you solve, who you help, and why you are different.",
      "Build one useful idea into a weekly series, measure saves and replies, then improve the next version.",
    ],
    outro: "Virality is a spike. Trust is a system you can keep building.",
    callToAction: input.callToAction || "Follow for practical content systems.",
    estimatedDuration: input.duration,
  };
}

export function makeFixtureStoryboard(input: ProjectInput, script = makeFixtureScript(input)): Storyboard {
  const raw = [
    { id: "scene-1", narration: script.hook, caption: "Viral isn't the goal", visualPrompt: "A lone creator at a desk, social graphs floating behind them, cinematic purple rim light", duration: 5 },
    { id: "scene-2", narration: script.mainPoints[0], caption: "Consistency creates recognition", visualPrompt: "Repeated bold editorial cards forming a recognizable visual system", duration: 7 },
    { id: "scene-3", narration: script.mainPoints[1], caption: "Your message compounds", visualPrompt: "Layered paper textures and growing concentric circles, premium editorial collage", duration: 7 },
    { id: "scene-4", narration: script.mainPoints[2], caption: "One idea. Every week.", visualPrompt: "Content calendar with one bright recurring series highlighted", duration: 7 },
    { id: "scene-5", narration: `${script.outro} ${script.callToAction}`, caption: "Build trust, not spikes", visualPrompt: "Calm upward path made of saved posts and audience replies, dark background", duration: 4 },
  ];
  return { scenes: normalizeSceneDurations(raw, input.duration) };
}

export function makeDemoProject(): Project {
  const now = new Date().toISOString();
  const script = makeFixtureScript(demoInput);
  return {
    ...demoInput,
    id: "6e65d391-f36b-4c5d-9538-4ea5cded5466",
    userId: "anonymous",
    status: "ready",
    script,
    storyboard: makeFixtureStoryboard(demoInput, script),
    assets: [],
    createdAt: now,
    updatedAt: now,
  };
}

