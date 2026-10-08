import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { verifyMagicToken } from "./magic-link";

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
      authorize(credentials) {
        const email = verifyMagicToken(String(credentials?.token ?? ""));
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
