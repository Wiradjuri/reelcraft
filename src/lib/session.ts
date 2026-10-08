import "server-only";

import { auth } from "@/lib/auth";
import { AppError } from "@/lib/http";

export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new AppError(401, "UNAUTHORIZED", "Sign in to continue.");
  }
  return session.user.id;
}
