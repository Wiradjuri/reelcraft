import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFile(path.join(process.cwd(), file), "utf8");

describe("credential boundary", () => {
  it("keeps provider keys in server-only code", async () => {
    const ai = await read("src/lib/ai.ts");
    const providers = await read("src/lib/ai-providers.ts");
    expect(ai).toContain('import "server-only"');
    expect(ai).toContain("process.env.OPENAI_API_KEY");
    expect(providers).toContain('import "server-only"');
    expect(providers).toContain("OPENAI_API_KEY");
  });

  it("never references provider keys in browser code", async () => {
    const browser = await read("src/components/ReelFlowApp.tsx");
    for (const name of ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "REELFLOW_TEXT_API_KEY", "REELFLOW_MEDIA_API_KEY", "NEXT_PUBLIC_OPENAI"]) {
      expect(browser).not.toContain(name);
    }
  });
});
