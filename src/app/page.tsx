"use client";

import { useSession, signIn } from "next-auth/react";
import { ReelFlowApp } from "@/components/ReelFlowApp";
import { Film, LoaderCircle } from "lucide-react";
import { useState } from "react";

function Landing() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || sending) return;
    setSending(true);
    try {
      await signIn("email", { email, redirect: false });
      setSent(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="landing">
      <div className="landing-hero">
        <div className="landing-brand"><Film size={28} /> ReelFlow</div>
        <h1>
          Turn one idea into<br />
          <em>a finished reel.</em>
        </h1>
        <p>
          Script, storyboard, voice-over and export — all in one focused flow.
          No timeline, no blank canvas. Just your idea, ready for the feed.
        </p>

        {sent ? (
          <div className="landing-sent">
            <p>Check your email for a sign-in link.</p>
            <button className="secondary-button" onClick={() => setSent(false)}>Back</button>
          </div>
        ) : (
          <>
            <form onSubmit={handleEmailSignIn} className="landing-email-form">
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="landing-email-input"
              />
              <button type="submit" className="primary-button" disabled={sending}>
                {sending ? "Sending…" : "Sign in with Email"}
              </button>
            </form>

            <div className="landing-divider"><span>or</span></div>

            <div className="landing-actions">
              <button className="secondary-button" onClick={() => signIn("github")}>
                Continue with GitHub
              </button>

            </div>
          </>
        )}

        <p className="landing-note">Free to use. No credit card required.</p>
      </div>
    </div>
  );
}

export default function Home() {
  const { status } = useSession();

  if (status === "loading") {
    return (
      <div className="landing">
        <div className="landing-hero">
          <LoaderCircle className="spin" size={30} />
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Landing />;
  }

  return <ReelFlowApp />;
}
