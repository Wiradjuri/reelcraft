import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { consumeMagicToken } from "./magic-link";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    Credentials({
      id: "magic-link",
      name: "Email",
      credentials: { token: { type: "text" } },
      async authorize(credentials) {
        const token = String(credentials?.token ?? "");
        // E2E smoke-test bypass: only active when E2E_AUTH_SECRET is set on the server.
        const e2e = process.env.E2E_AUTH_SECRET;
        if (e2e && token === `e2e:${e2e}`) return { id: "email:e2e@reelflow.test", email: "e2e@reelflow.test" };
        const email = await consumeMagicToken(token);
        return email ? { id: `email:${email}`, email } : null;
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user, profile }) {
      if (user?.id) token.sub = user.id;
      else if (profile?.sub) token.sub = profile.sub;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
  pages: { signIn: "/" },
});
