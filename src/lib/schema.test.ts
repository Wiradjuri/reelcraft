import { describe, expect, it } from "vitest";
import { demoInput, makeFixtureScript, makeFixtureStoryboard } from "./fixtures";
import { scriptSchema, storyboardSchema } from "./schema";

describe("generation schemas", () => {
  it("accepts a complete structured script and storyboard", () => {
    const script = makeFixtureScript(demoInput);
    expect(scriptSchema.parse(script).hook).toContain("viral");
    expect(storyboardSchema.parse(makeFixtureStoryboard(demoInput, script)).scenes).toHaveLength(5);
  });

  it("rejects invalid and incomplete model responses", () => {
    expect(scriptSchema.safeParse({ hook: "Only a hook" }).success).toBe(false);
    expect(storyboardSchema.safeParse({ scenes: [{ id: "one", caption: "Missing narration" }] }).success).toBe(false);
    expect(storyboardSchema.safeParse({ scenes: [] }).success).toBe(false);
  });
});

