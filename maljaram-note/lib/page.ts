import { redirect } from "next/navigation";
import { ChildRepo, type Child } from "@/lib/repo/child-repo";
import { createServerClient, currentUserId, type Db } from "@/lib/supabase/server";

// 화면(서버 컴포넌트) 공통: 로그인 + 아이 등록 확인. 아이가 없으면 등록 화면으로
export async function requireChild(): Promise<{ db: Db; userId: string; child: Child }> {
  const db = await createServerClient();
  const userId = await currentUserId(db);
  if (!userId) redirect("/login");
  const child = await new ChildRepo(db).first();
  if (!child) redirect("/onboarding");
  return { db, userId, child };
}
