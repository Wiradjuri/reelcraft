"use client";

import { useSession, signIn } from "next-auth/react";
import { ReelFlowApp } from "@/components/ReelFlowApp";
import { Film, LoaderCircle } from "lucide-react";

function Landing() {
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
        <div className="landing-actions">
          <button className="primary-button" onClick={() => signIn("github")}>
            Sign in with GitHub
          </button>
          <button className="secondary-button" onClick={() => signIn("google")}>
            Sign in with Google
          </button>
        </div>
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
