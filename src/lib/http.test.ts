import { describe, expect, it, vi } from "vitest";
import { apiError, AppError } from "./http";

describe("API errors", () => {
  it("returns safe messages and status codes for expected errors", async () => {
    const response = apiError(new AppError(429, "RATE_LIMITED", "Wait and retry."));
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "Wait and retry.", code: "RATE_LIMITED" });
  });

  it("does not expose internal exception details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = apiError(new Error("secret database path"));
    expect(JSON.stringify(await response.json())).not.toContain("secret database path");
  });
});

