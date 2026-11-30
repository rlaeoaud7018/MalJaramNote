import { createServerClient as createSsrClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

// 요청한 사용자 권한으로 접근하는 클라이언트. RLS가 그대로 적용된다
export async function createServerClient() {
  const store = await cookies();
  return createSsrClient(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // 서버 컴포넌트에서는 쿠키를 쓸 수 없다. 세션 갱신은 middleware가 맡는다
        }
      },
    },
  });
}

export type Db = Awaited<ReturnType<typeof createServerClient>>;

// 로그인 사용자 ID. 없으면 null
export async function currentUserId(db: Db): Promise<string | null> {
  const { data } = await db.auth.getUser();
  return data.user?.id ?? null;
}
