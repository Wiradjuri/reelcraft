import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
    {
      id: "email",
      type: "email",
      name: "Email",
      maxAge: 24 * 60 * 60,
      sendVerificationRequest: async ({ identifier: email, url }) => {
        await resend.emails.send({
          from: "ReelFlow <onboarding@resend.dev>",
          to: email,
          subject: "Sign in to ReelFlow",
          html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px">
            <h1 style="font-size:24px;margin-bottom:16px">Sign in to ReelFlow</h1>
            <p style="color:#888;font-size:15px;line-height:1.6;margin-bottom:24px">Click the button below to sign in. This link expires in 24 hours.</p>
            <a href="${url}" style="display:inline-block;background:#d9ff77;color:#111;font-weight:700;font-size:14px;padding:13px 28px;border-radius:10px;text-decoration:none">Sign in to ReelFlow</a>
            <p style="color:#666;font-size:12px;margin-top:32px">If you didn\'t request this email, you can safely ignore it.</p>
          </div>`,
        });
      },
    },
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
