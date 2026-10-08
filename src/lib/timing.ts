import type { Scene } from "./schema";

export type CaptionCue = {
  text: string;
  startFrame: number;
  endFrame: number;
};

export function normalizeSceneDurations(scenes: Scene[], targetSeconds: number): Scene[] {
  if (!scenes.length || targetSeconds <= 0) return scenes;
  const current = scenes.reduce((sum, scene) => sum + scene.duration, 0);
  if (current <= 0) return scenes;
  const scaled = scenes.map((scene) => ({ ...scene, duration: (scene.duration / current) * targetSeconds }));
  const rounded = scaled.map((scene) => ({ ...scene, duration: Math.round(scene.duration * 10) / 10 }));
  const total = rounded.reduce((sum, scene) => sum + scene.duration, 0);
  rounded[rounded.length - 1].duration = Math.max(1, Math.round((rounded.at(-1)!.duration + targetSeconds - total) * 10) / 10);
  return rounded;
}

export function createCaptionCues(scene: Scene, startFrame: number, fps: number): CaptionCue[] {
  const words = scene.caption.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const groups: string[] = [];
  for (let index = 0; index < words.length; index += 4) groups.push(words.slice(index, index + 4).join(" "));
  const sceneFrames = Math.max(groups.length, Math.round(scene.duration * fps));
  return groups.map((text, index) => ({
    text,
    startFrame: startFrame + Math.floor((index * sceneFrames) / groups.length),
    endFrame: startFrame + Math.floor(((index + 1) * sceneFrames) / groups.length),
  }));
}

export function totalFrames(scenes: Scene[], fps = 30): number {
  return Math.max(1, Math.round(scenes.reduce((sum, scene) => sum + scene.duration, 0) * fps));
}

