import { z } from "zod";
import { apiError, throttle } from "@/lib/http";
import { createMagicToken, sendMagicLink } from "@/lib/magic-link";

export const runtime = "nodejs";

const bodySchema = z.object({ email: z.string().trim().email().max(254) });

export async function POST(request: Request) {
  try {
    const { email } = bodySchema.parse(await request.json());
    throttle(`magic:${email.toLowerCase()}`, 3, 10 * 60_000);
    const origin = (process.env.NODE_ENV === "production" && process.env.AUTH_URL ? process.env.AUTH_URL : new URL(request.url).origin).replace(/\/$/, "");
    const token = createMagicToken(email);
    await sendMagicLink(email, `${origin}/verify?token=${encodeURIComponent(token)}`);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
