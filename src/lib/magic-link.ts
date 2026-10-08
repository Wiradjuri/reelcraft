import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "./http";

const TTL_MS = 15 * 60 * 1000;

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is required for magic links.");
  return value;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createMagicToken(email: string) {
  const payload = Buffer.from(JSON.stringify({ email: email.trim().toLowerCase(), exp: Date.now() + TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyMagicToken(token: string): string | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { email?: string; exp?: number };
    if (!data.email || !data.exp || data.exp < Date.now()) return null;
    return data.email;
  } catch {
    return null;
  }
}

export async function sendMagicLink(email: string, url: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is required to send sign-in emails.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "ReelFlow <onboarding@resend.dev>",
      to: email,
      subject: "Sign in to ReelFlow",
      html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px">
        <h1 style="font-size:24px;margin-bottom:16px">Sign in to ReelFlow</h1>
        <p style="color:#666;font-size:15px;line-height:1.6;margin-bottom:24px">Click the button below to sign in. This link expires in 15 minutes.</p>
        <a href="${url}" style="display:inline-block;background:#d9ff77;color:#111;font-weight:700;font-size:14px;padding:13px 28px;border-radius:10px;text-decoration:none">Sign in to ReelFlow</a>
        <p style="color:#888;font-size:12px;margin-top:32px">If you didn't request this email, you can safely ignore it.</p>
      </div>`,
    }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    if (response.status === 403 && body.message?.includes("own email address")) {
      throw new AppError(403, "EMAIL_SANDBOX", "Email sign-in is in sandbox mode and can only reach the account owner right now. Use GitHub or Google to sign in.");
    }
    throw new AppError(502, "EMAIL_SEND_FAILED", "The sign-in email could not be sent. Try again or use GitHub or Google.");
  }
}
