"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { LoaderCircle } from "lucide-react";

export default function VerifyPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) { setError("This sign-in link is missing its token."); return; }
    void signIn("magic-link", { token, redirect: false }).then((result) => {
      if (result?.error) setError("This sign-in link is invalid or has expired. Request a new one.");
      else window.location.href = "/";
    });
  }, []);

  return (
    <div className="landing">
      <div className="landing-hero">
        {error ? (
          <>
            <p style={{ color: "#ff8399", marginBottom: 20 }}>{error}</p>
            <a className="secondary-button" href="/">Back to sign in</a>
          </>
        ) : (
          <>
            <LoaderCircle className="spin" size={30} />
            <p style={{ marginTop: 20 }}>Signing you in…</p>
          </>
        )}
      </div>
    </div>
  );
}
