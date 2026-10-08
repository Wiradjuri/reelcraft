import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function apiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Some fields are invalid or incomplete.", code: "INVALID_INPUT", details: error.issues }, { status: 400 });
  }
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 500;
  if (status === 429) return NextResponse.json({ error: "OpenAI is busy or the rate limit was reached. Wait a moment and try again.", code: "RATE_LIMITED" }, { status: 429 });
  if (status === 400) return NextResponse.json({ error: "The generation request was rejected. Review the content and try again.", code: "REQUEST_REJECTED" }, { status: 400 });
  console.error("ReelFlow request failed", error instanceof Error ? error.message : "Unknown error");
  return NextResponse.json({ error: "Something went wrong while processing the request. Your project is still saved.", code: "INTERNAL_ERROR" }, { status: 500 });
}

const calls = new Map<string, number[]>();
export function throttle(key: string, limit = 12, windowMs = 60_000) {
  const now = Date.now();
  const recent = (calls.get(key) ?? []).filter((time) => time > now - windowMs);
  if (recent.length >= limit) throw new AppError(429, "RATE_LIMITED", "Too many requests. Wait a moment and try again.");
  recent.push(now);
  calls.set(key, recent);
}

export function assertProjectId(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new AppError(400, "INVALID_PROJECT_ID", "The project identifier is invalid.");
  }
}

