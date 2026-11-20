# 말자람 노트 API 명세서

- Base URL: `https://maljaram.vercel.app` (예시)
- 인증: Supabase Auth 세션 쿠키. 모든 API는 로그인이 필요하며 본인 데이터만 접근합니다(RLS).
- 공통 에러 형식:

```json
{ "error": { "code": "SESSION_NOT_FOUND", "message": "회기를 찾을 수 없습니다." } }
```

| HTTP | code | 상황 |
|---|---|---|
| 400 | INVALID_INPUT | 입력값 오류 |
| 401 | UNAUTHORIZED | 로그인 필요 |
| 403 | CONSENT_REQUIRED | 녹음 동의 미확인 |
| 404 | *_NOT_FOUND | 리소스 없음 또는 타인 리소스 |
| 413 | FILE_TOO_LARGE | 25MB 초과 |
| 429 | QUOTA_EXCEEDED | 테스트 기간 1인 10회 초과 |
| 502 | AI_PROVIDER_ERROR | STT·요약 API 실패 |

---

## 목록

| No | Method | URL | 설명 | 기능 ID |
|---|---|---|---|---|
| 1 | POST | `/api/children` | 아이 프로필 등록 | F-003~007 |
| 2 | PATCH | `/api/children/{childId}` | 아이 프로필 수정 | F-036 |
| 3 | POST | `/api/sessions` | 회기 생성 + 업로드 URL 발급 | F-011~016 |
| 4 | POST | `/api/sessions/{sessionId}/process` | STT → 요약 → 숙제 생성 | F-018~021 |
| 5 | GET | `/api/sessions/{sessionId}/status` | 처리 상태 조회 (폴링) | F-017 |
| 6 | GET | `/api/sessions?childId=&cursor=` | 회기 타임라인 | F-022 |
| 7 | GET | `/api/sessions/{sessionId}` | 회기 상세 | F-023~028 |
| 8 | PUT | `/api/sessions/{sessionId}/summary` | 요약·숙제 수정 | F-029 |
| 9 | DELETE | `/api/sessions/{sessionId}` | 회기 삭제 | F-030 |
| 10 | GET | `/api/homework?range=this_week` | 숙제 모아보기 | F-008, F-031 |
| 11 | PATCH | `/api/homework/{homeworkId}` | 숙제 완료 체크/해제 | F-025, F-032 |
| 12 | PATCH | `/api/me/settings` | 설정 변경 | F-034, F-035 |
| 13 | POST | `/api/push/subscribe` | Web Push 구독 등록 (5주차) | F-033 |
| 14 | GET | `/api/cron/homework-reminder` | 숙제 알림 발송 (Vercel Cron) | F-033 |
| 15 | POST | `/api/events` | 사용 이벤트 기록 | F-039 |
| 16 | DELETE | `/api/me` | 회원 탈퇴 (전체 데이터 삭제) | F-038 |

---

## 3. 회기 생성

`POST /api/sessions`

```json
// Request
{
  "childId": "7c1e...",
  "sessionDate": "2026-12-08",
  "consentConfirmed": true,
  "fileName": "recording.webm",
  "fileSize": 4823011,
  "mimeType": "audio/webm"
}
// Response 201
{
  "sessionId": "a91f...",
  "upload": {
    "path": "user_3f2a/a91f.webm",
    "signedUrl": "https://xxx.supabase.co/storage/v1/upload/sign/...",
    "expiresIn": 300
  }
}
```
- `consentConfirmed`가 `false`면 403 `CONSENT_REQUIRED`
- 허용 MIME: `audio/webm`, `audio/mp4`, `audio/m4a`, `audio/mpeg`

## 4. 회기 처리

`POST /api/sessions/{sessionId}/process`

- 상태 전이: `UPLOADED → TRANSCRIBING → SUMMARIZING → DONE` (실패 시 `FAILED`)
- 처리 순서
  1. Storage에서 음성 다운로드 → Whisper API (`language: ko`, prompt에 치료 용어 사전과 아이 별칭)
  2. `transcript` 저장 → Claude API로 요약 (아래 스키마)
  3. `session_summaries`, `homework` 저장
  4. 설정 `auto_delete_audio = true`면 음성 원본 삭제, `audio_deleted_at` 기록

```json
// Response 202
{ "sessionId": "a91f...", "status": "TRANSCRIBING" }
```

### 요약 JSON 스키마 (LLM 출력)
```json
{
  "activities": ["그림 카드 보고 2어절로 말하기", "/ㅅ/ 소리 단어 따라 말하기"],
  "child_response": "초반에는 집중이 어려웠지만 후반에는 '사과 줘'처럼 2어절 표현을 스스로 4회 시도함",
  "homework": [
    { "content": "간식 시간에 '○○ 줘'로 요청하게 하기", "frequency": "매일" },
    { "content": "/ㅅ/ 단어 카드 5장 하루 2번 따라 말하기", "frequency": "하루 2회" }
  ],
  "next_goal": "2어절 자발 표현을 회기당 10회 이상으로 늘리기"
}
```
- 프롬프트 제약: 진단·예후 판단 금지, 녹음에 없는 숙제 생성 금지, 숙제가 언급되지 않았으면 빈 배열

## 5. 처리 상태 조회

`GET /api/sessions/{sessionId}/status`
```json
{ "status": "SUMMARIZING", "updatedAt": "2026-12-08T10:41:22+09:00", "errorMessage": null }
```

## 7. 회기 상세

`GET /api/sessions/{sessionId}`
```json
{
  "id": "a91f...",
  "sessionDate": "2026-12-08",
  "durationSec": 486,
  "status": "DONE",
  "summary": {
    "activities": ["..."],
    "childResponse": "...",
    "nextGoal": "...",
    "edited": false
  },
  "homework": [
    { "id": "h1...", "content": "...", "frequency": "매일", "isDone": false }
  ],
  "transcript": "선생님: 오늘은 그림 카드로...",
  "audioUrl": "https://...signed... (원본 삭제 시 null)"
}
```

## 8. 요약 수정

`PUT /api/sessions/{sessionId}/summary`
```json
{
  "activities": ["..."],
  "childResponse": "...",
  "nextGoal": "...",
  "homework": [
    { "id": "h1...", "content": "수정된 숙제", "frequency": "매일" },
    { "content": "새로 추가한 숙제", "frequency": "주 3회" }
  ]
}
```
- `id`가 없는 숙제는 추가, 요청에 없는 기존 숙제는 삭제
- 저장 시 `edited = true`, 이벤트 `summary_edited` 기록

## 10. 숙제 모아보기

`GET /api/homework?range=this_week|last_week|all`
```json
{
  "items": [
    { "id": "h1...", "sessionId": "a91f...", "sessionDate": "2026-12-08",
      "content": "...", "frequency": "매일", "isDone": false, "doneAt": null }
  ],
  "progress": { "done": 3, "total": 5 }
}
```

## 11. 숙제 체크

`PATCH /api/homework/{homeworkId}`
```json
// Request
{ "isDone": true }
// Response 200
{ "id": "h1...", "isDone": true, "doneAt": "2026-12-08T20:13:05+09:00" }
```

## 15. 이벤트 기록

`POST /api/events`
```json
{ "name": "homework_checked", "props": { "homeworkId": "h1..." } }
```
| 이벤트 | 시점 |
|---|---|
| `recording_started` / `recording_failed` | 녹음 시작 / 중단·실패 |
| `session_uploaded` | 업로드 완료 |
| `summary_viewed` | 회기 상세 진입 |
| `summary_edited` | 요약 수정 저장 |
| `homework_checked` | 숙제 완료 체크 |
| `reminder_clicked` | 알림 클릭 진입 (5주차) |

## 16. 회원 탈퇴

`DELETE /api/me` → 204
- Storage 음성 파일 → DB 데이터(CASCADE) → Auth 사용자 순서로 삭제
