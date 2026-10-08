import { describe, expect, it } from "vitest";
import { createCaptionCues, normalizeSceneDurations, totalFrames } from "./timing";
import type { Scene } from "./schema";

const scenes: Scene[] = [
  { id: "one", narration: "One", caption: "Consistency makes a brand memorable", visualPrompt: "One", duration: 3 },
  { id: "two", narration: "Two", caption: "Trust compounds", visualPrompt: "Two", duration: 7 },
];

describe("video timing", () => {
  it("scales scene duration to the requested total", () => {
    const normalized = normalizeSceneDurations(scenes, 30);
    expect(normalized.reduce((sum, scene) => sum + scene.duration, 0)).toBe(30);
    expect(totalFrames(normalized)).toBe(900);
  });

  it("creates ordered caption cues inside the scene boundary", () => {
    const cues = createCaptionCues(scenes[0], 30, 30);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toEqual({ text: "Consistency makes a brand", startFrame: 30, endFrame: 75 });
    expect(cues[1].endFrame).toBe(120);
  });
});

