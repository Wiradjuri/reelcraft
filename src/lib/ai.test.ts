import { describe, expect, it } from "vitest";
import { demoInput, makeFixtureScript, makeFixtureStoryboard } from "./fixtures";
import { parsePlanOutput } from "./ai";

describe("provider plan output", () => {
  const script = makeFixtureScript(demoInput);
  const plan = { script, storyboard: makeFixtureStoryboard(demoInput, script) };

  it("accepts valid JSON with or without a Markdown fence", () => {
    expect(parsePlanOutput(JSON.stringify(plan))).toEqual(plan);
    expect(parsePlanOutput("```json\n" + JSON.stringify(plan) + "\n```")).toEqual(plan);
  });

  it("rejects malformed and incomplete provider output", () => {
    expect(() => parsePlanOutput("not json")).toThrow(/invalid plan/);
    expect(() => parsePlanOutput(JSON.stringify({ script: { hook: "incomplete" } }))).toThrow(/incomplete plan/);
  });
});
