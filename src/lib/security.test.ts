import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("credential boundary", () => {
  it("keeps the OpenAI key in server-only code", async () => {
    const client = await readFile(path.join(process.cwd(), "src/lib/openai.ts"), "utf8");
    const browser = await readFile(path.join(process.cwd(), "src/components/ReelFlowApp.tsx"), "utf8");
    expect(client).toContain('import "server-only"');
    expect(client).toContain("process.env.OPENAI_API_KEY");
    expect(browser).not.toContain("OPENAI_API_KEY");
    expect(browser).not.toContain("NEXT_PUBLIC_OPENAI");
  });
});

