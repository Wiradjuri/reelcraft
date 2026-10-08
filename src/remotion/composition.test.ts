import { describe, expect, it } from "vitest";
import { demoProps } from "./Root";
import { createCaptionCues, totalFrames } from "@/lib/timing";

describe("deterministic Remotion composition", () => {
  it("produces a vertical 30-second timeline with timed captions", () => {
    expect(demoProps.scenes).toHaveLength(5);
    expect(totalFrames(demoProps.scenes, 30)).toBe(900);
    expect(createCaptionCues(demoProps.scenes[0], 0, 30).at(-1)?.endFrame).toBe(150);
  });
});
