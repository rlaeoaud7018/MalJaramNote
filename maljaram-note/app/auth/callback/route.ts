import { NextResponse, type NextRequest } from "next/server";
import { ChildRepo } from "@/lib/repo/child-repo";
import { createServerClient } from "@/lib/supabase/server";

// AuthRoutes · FNC-A-001: 카카오 OAuth code → 세션. 아이가 없으면 등록 화면으로
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const to = (path: string) => NextResponse.redirect(new URL(path, url.origin));

  // 카카오 동의 화면에서 취소하면 code 없이 error가 온다
  if (url.searchParams.get("error")) return to("/login?error=cancelled");
  const code = url.searchParams.get("code");
  if (!code) return to("/login?error=callback");

  const db = await createServerClient();
  const { error } = await db.auth.exchangeCodeForSession(code);
  if (error) return to("/login?error=callback");

  const child = await new ChildRepo(db).first().catch(() => null);
  if (!child) return to("/onboarding");
  const next = url.searchParams.get("next");
  // 외부 주소로 보내지 않도록 같은 사이트 경로만 허용
  return to(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
}
