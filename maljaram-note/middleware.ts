import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// FNC-A-003 접근 제어: 공개 경로 외에는 로그인 필요. 화면은 /login으로, API는 401
const PUBLIC = ["/login", "/auth/callback", "/manifest.json", "/sw.js", "/icons", "/api/cron"];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    if (PUBLIC.some((p) => path.startsWith(p))) return response;
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." } }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login?error=config", request.url));
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // 세션 확인과 동시에 만료 전 토큰을 갱신한다
  const { data } = await supabase.auth.getUser();

  if (PUBLIC.some((p) => path.startsWith(p))) {
    if (data.user && path === "/login") return NextResponse.redirect(new URL("/", request.url));
    return response;
  }
  if (!data.user) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." } }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
