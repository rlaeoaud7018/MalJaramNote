# 말자람 노트 ERD

- DBMS: PostgreSQL 15 (Supabase)
- 모든 테이블에 RLS 적용: `user_id = auth.uid()` 또는 소유 관계를 따라 검사
- 상세 컬럼 정의는 `테이블정의서_말자람노트.docx` 참고

```mermaid
erDiagram
    profiles ||--o{ children : "보호자-아이"
    children ||--o{ sessions : "아이-회기"
    sessions ||--|| session_summaries : "회기-요약"
    sessions ||--o{ homework : "회기-숙제"
    profiles ||--o{ push_subscriptions : "알림 구독"
    profiles ||--o{ event_logs : "사용 로그"

    profiles {
        uuid id PK "auth.users.id"
        varchar nickname
        boolean auto_delete_audio
        boolean notify_homework
        time notify_time
        timestamptz created_at
    }
    children {
        uuid id PK
        uuid user_id FK
        varchar nickname
        date birth_month
        varchar therapy_type
        varchar center_name
        timestamptz created_at
    }
    sessions {
        uuid id PK
        uuid child_id FK
        uuid user_id FK
        date session_date
        varchar status
        boolean consent_confirmed
        text audio_path
        int duration_sec
        text transcript
        text error_message
        timestamptz audio_deleted_at
        timestamptz created_at
    }
    session_summaries {
        uuid id PK
        uuid session_id FK "UNIQUE"
        jsonb activities
        text child_response
        text next_goal
        boolean edited
        varchar model_version
        varchar prompt_version
        timestamptz updated_at
    }
    homework {
        uuid id PK
        uuid session_id FK
        uuid child_id FK
        uuid user_id FK
        varchar content
        varchar frequency
        boolean is_done
        timestamptz done_at
        smallint sort_order
    }
    push_subscriptions {
        uuid id PK
        uuid user_id FK
        text endpoint
        jsonb keys
        timestamptz created_at
    }
    event_logs {
        bigint id PK
        uuid user_id FK
        varchar event_name
        jsonb props
        timestamptz created_at
    }
```

## 설계 메모
- `sessions.user_id`, `homework.user_id`는 정규화 관점에서는 중복이지만, RLS 정책을 조인 없이 `user_id = auth.uid()`로 단순화하려고 의도적으로 두었습니다.
- `session_summaries.prompt_version`으로 5주차 프롬프트 개선 전후의 요약 수정 비율을 비교합니다.
- 회기 삭제 시 `session_summaries`, `homework`는 `ON DELETE CASCADE`, 음성 파일은 API에서 Storage를 먼저 삭제합니다.
