# 말자람 노트

치료 상담은 녹음만, 정리는 AI가. 언어치료(놀이치료·감각통합도 선택 가능) 회기 후 상담을 녹음하면 받아쓰기(Whisper)와 요약(Claude)을 거쳐 4개 섹션 요약과 집에서 할 숙제 체크리스트를 만듭니다.

Next.js 15 (App Router) · Supabase (Auth·Postgres·Storage) · OpenAI Whisper · Anthropic Claude · Web Push · Vercel Cron

## 실행 전 준비

1. **Supabase 프로젝트**: `supabase/migrations/0001~0004`를 순서대로 SQL Editor에서 실행합니다(테이블, RLS, RPC, 지표 뷰, audio 버킷).
2. **카카오 로그인**: Supabase Auth → Providers → Kakao를 켜고, 카카오 개발자 콘솔의 동의 항목은 닉네임만 켭니다. 이메일을 받지 않으므로 Supabase에서 "Allow users without an email"을 켭니다. Redirect URL에 `https://<배포 주소>/auth/callback`을 넣습니다.
3. **환경 변수**: `.env.example`을 `.env.local`로 복사해 채웁니다. VAPID 키는 `npx web-push generate-vapid-keys`로 만듭니다.

```
npm install
npm run dev        # http://localhost:3000
npm test           # 단위 테스트 (외부 서비스 없이 실행)
npm run typecheck
npm run build
```

## 구조

| 경로 | 내용 |
|---|---|
| `app/` | 화면 10개(SCR-001~010)와 API 라우트 18개 |
| `lib/pipeline` | `SessionPipeline`(받아쓰기→요약→저장→원본 삭제), `AudioJanitor` |
| `lib/ai` | `Transcriber`(Whisper, 용어 사전 48개), `Summarizer`(구조화 출력 + zod), 프롬프트 v2 |
| `lib/repo` | 테이블별 저장소 클래스 |
| `lib/recorder`, `lib/push` | 브라우저 녹음·화면 유지·업로드 보관(IndexedDB)·폴링·푸시 구독 |
| `lib/validation` | zod 스키마, 공통 오류 응답 |
| `supabase/migrations` | DB 스키마·RLS·RPC |

## 명세와 다른 점

- 음성 업로드용 Signed Upload URL은 Supabase에서 2시간으로 고정되어 있어 `expiresIn: 7200`을 돌려줍니다. 재생용 Signed URL은 명세대로 5분입니다.
- 처리 파이프라인은 사용자 권한으로 처리 권한을 선점(조건부 update)한 뒤, 응답 후 `after()`에서 관리자 클라이언트로 실행합니다. 처리 도중 사용자 토큰이 만료돼도 끊기지 않게 하기 위해서입니다.
- 사용량 제한(10건, 삭제한 회기 포함)은 회기 생성 때 남기는 `session_uploaded` 이벤트 수로 셉니다.
