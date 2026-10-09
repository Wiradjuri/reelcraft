import { describe, expect, it } from "vitest";
import { resolveTextProvider } from "./ai-providers";

describe("text provider configuration", () => {
  it("preserves the existing OpenAI defaults", () => {
    expect(resolveTextProvider({ OPENAI_API_KEY: "test-key" })).toMatchObject({
      id: "openai",
      api: "openai-compatible",
      planningModel: "gpt-6.1-sol",
      copyModel: "gpt-6-luna",
    });
  });

  it("resolves a hosted OpenAI-compatible provider", () => {
    expect(resolveTextProvider({
      REELFLOW_TEXT_PROVIDER: "google",
      GEMINI_API_KEY: "test-key",
      GEMINI_PLANNING_MODEL: "gemini-test",
    })).toMatchObject({
      id: "google",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      planningModel: "gemini-test",
      copyModel: "gemini-test",
    });
  });

  it("allows keyless local LM Studio and an endpoint override", () => {
    expect(resolveTextProvider({
      REELFLOW_TEXT_PROVIDER: "lmstudio",
      REELFLOW_TEXT_BASE_URL: "http://192.168.1.20:1234/v1",
      REELFLOW_PLANNING_MODEL: "local-model",
    })).toMatchObject({
      id: "lmstudio",
      apiKey: undefined,
      baseURL: "http://192.168.1.20:1234/v1",
      planningModel: "local-model",
      copyModel: "local-model",
    });
  });

  it("requires credentials for hosted providers", () => {
    expect(() => resolveTextProvider({
      REELFLOW_TEXT_PROVIDER: "openrouter",
      REELFLOW_PLANNING_MODEL: "provider/model",
    })).toThrow(/OPENROUTER_API_KEY/);
  });

  it("rejects unknown providers and missing custom endpoints", () => {
    expect(() => resolveTextProvider({ REELFLOW_TEXT_PROVIDER: "unknown" })).toThrow(/must be one of/);
    expect(() => resolveTextProvider({
      REELFLOW_TEXT_PROVIDER: "custom",
      REELFLOW_TEXT_API_KEY: "test-key",
      REELFLOW_PLANNING_MODEL: "test-model",
    })).toThrow(/REELFLOW_TEXT_BASE_URL/);
  });
});
