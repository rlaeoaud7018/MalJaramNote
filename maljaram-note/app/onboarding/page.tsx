import { redirect } from "next/navigation";
import { ChildForm } from "@/components/ChildForm";
import { BackLink, Sprout } from "@/components/ui";
import { ChildRepo } from "@/lib/repo/child-repo";
import { createServerClient, currentUserId } from "@/lib/supabase/server";

// SCR-002 아이 프로필 등록. ?edit=1이면 설정에서 들어온 수정 모드
export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const db = await createServerClient();
  if (!(await currentUserId(db))) redirect("/login");
  const child = await new ChildRepo(db).first();
  if (child && !edit) redirect("/");
  if (!child && edit) redirect("/onboarding");

  return (
    <main className="app no-nav">
      {child ? (
        <div className="top">
          <BackLink href="/settings" label="설정" />
        </div>
      ) : (
        <div className="brand" style={{ marginBottom: 12 }}>
          <Sprout /> 말자람 노트
        </div>
      )}
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>{child ? "아이 정보 수정" : "아이를 소개해 주세요"}</h1>
      <p className="hint">요약에 아이 별칭과 치료 종류가 쓰여요.</p>
      <ChildForm initial={child ?? undefined} />
    </main>
  );
}
