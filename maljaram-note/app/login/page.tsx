import { Sprout } from "@/components/ui";
import { KakaoButton } from "./KakaoButton";

const ERRORS: Record<string, string> = {
  cancelled: "로그인이 취소되었습니다.",
  callback: "로그인 중 문제가 생겼어요. 다시 시도해 주세요.",
  config: "서버 설정(Supabase 환경 변수)이 필요합니다.",
};

// SCR-001 로그인
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="app no-nav">
      <div className="login-hero">
        <Sprout size={72} />
        <h1>말자람 노트</h1>
        <p>상담은 녹음만, 정리는 AI가</p>
      </div>
      <div className="points">
        <div>
          <b>회기 요약</b> 오늘 한 활동, 아이 반응, 다음 목표를 정리해요
        </div>
        <div>
          <b>집에서 할 숙제</b> 치료사가 말한 숙제를 체크리스트로 만들어요
        </div>
        <div>
          <b>음성은 자동 삭제</b> 요약이 끝나면 녹음 원본은 지워져요
        </div>
      </div>
      {error && ERRORS[error] && (
        <p className="error-text" role="alert" style={{ textAlign: "center", marginBottom: 12 }}>
          {ERRORS[error]}
        </p>
      )}
      <KakaoButton />
      <p className="hint" style={{ textAlign: "center" }}>
        카카오에서는 닉네임만 받아요. 아이 실명은 저장하지 않아요.
      </p>
    </main>
  );
}
