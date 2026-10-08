import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Nodemailer from "next-auth/providers/nodemailer";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
    Nodemailer({
      server: {
        host: "smtp.resend.com",
        port: 465,
        auth: {
          user: "resend",
          pass: process.env.RESEND_API_KEY,
        },
      },
      from: "ReelFlow <onboarding@resend.dev>",
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, profile }) {
      if (profile) {
        token.sub = profile.sub ?? token.sub;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
});
