"use client";
import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase/browser";

// FNC-A-001: Supabase OAuth(kakao). 동의 항목은 닉네임만
export function KakaoButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function login() {
    setBusy(true);
    setError(null);
    try {
      const { error } = await createBrowserClient().auth.signInWithOAuth({
        provider: "kakao",
        options: { redirectTo: `${location.origin}/auth/callback`, scopes: "profile_nickname" },
      });
      if (error) throw error;
    } catch {
      setBusy(false);
      setError("로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
  }

  return (
    <>
      <button className="btn kakao" onClick={login} disabled={busy}>
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#191600" d="M12 3C6.5 3 2 6.5 2 10.8c0 2.8 1.9 5.2 4.7 6.6l-1 3.6c-.1.3.3.6.6.4l4.2-2.8c.5.1 1 .1 1.5.1 5.5 0 10-3.5 10-7.9S17.5 3 12 3z" />
        </svg>
        {busy ? "카카오로 이동 중…" : "카카오로 시작하기"}
      </button>
      {error && <p className="error-text" role="alert">{error}</p>}
    </>
  );
}
