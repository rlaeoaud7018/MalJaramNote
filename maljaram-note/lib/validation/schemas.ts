import { z } from "zod";
import { addDays, ageInYears, todayKst } from "@/lib/time";

// 클래스 다이어그램 · Schemas(zod). 화면 명세 SCR-002/004/007/010의 검증 규칙과 같다

export const THERAPY_TYPES = ["SPEECH", "PLAY", "SENSORY", "ETC"] as const;
export const AUDIO_MIME = ["audio/webm", "audio/mp4", "audio/m4a", "audio/x-m4a", "audio/mpeg"] as const;
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
export const EVENT_NAMES = [
  "recording_started",
  "recording_failed",
  "session_uploaded",
  "summary_viewed",
  "summary_edited",
  "homework_checked",
  "reminder_clicked",
] as const;

const nickname = z.string().trim().min(1, { error: "1~30자로 입력해 주세요." }).max(30, { error: "1~30자로 입력해 주세요." });
const birthMonth = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: "생년월을 선택해 주세요." })
  .refine((v) => v <= todayKst().slice(0, 7), { error: "미래 월은 선택할 수 없어요." })
  .refine((v) => ageInYears(v) <= 12, { error: "만 0~12세만 등록할 수 있어요." });
const centerName = z.string().trim().max(50, { error: "50자 이하로 입력해 주세요." });

export const ChildCreate = z.object({
  nickname,
  birthMonth: birthMonth.nullish(),
  therapyType: z.enum(THERAPY_TYPES).default("SPEECH"),
  centerName: centerName.nullish(),
});
export const ChildUpdate = ChildCreate.partial().refine((v) => Object.keys(v).length > 0, { error: "수정할 항목이 없어요." });

export const SessionCreate = z.object({
  childId: z.uuid({ error: "아이 ID가 올바르지 않아요." }),
  sessionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "날짜 형식이 올바르지 않아요." })
    .refine((v) => v <= todayKst() && v >= addDays(todayKst(), -30), { error: "오늘부터 30일 전까지만 선택할 수 있어요." }),
  consentConfirmed: z.boolean(),
  fileName: z.string().min(1).max(200),
  fileSize: z.number().int().positive(),
  mimeType: z.enum(AUDIO_MIME, { error: "m4a·mp3·webm 파일만 올릴 수 있어요." }),
});

const longText = z.string().max(1000, { error: "1000자 이하로 입력해 주세요." });
export const HomeworkItem = z.object({
  id: z.uuid().optional(),
  content: z.string().trim().min(1, { error: "숙제 내용을 입력해 주세요." }).max(200, { error: "200자 이하로 입력해 주세요." }),
  frequency: z.string().trim().max(50, { error: "50자 이하로 입력해 주세요." }).default(""),
});
export const SummaryUpdate = z.object({
  activities: z.array(longText).max(20),
  childResponse: longText,
  nextGoal: longText,
  homework: z.array(HomeworkItem).max(10, { error: "숙제는 10개까지 넣을 수 있어요." }),
});

export const HomeworkCheck = z.object({ isDone: z.boolean() });
export const HomeworkRange = z.enum(["this_week", "last_week", "all"]).default("this_week");

export const SettingsUpdate = z
  .object({
    autoDeleteAudio: z.boolean(),
    notifyHomework: z.boolean(),
    notifyTime: z.string().regex(/^([01]\d|2[0-3]):(00|30)$/, { error: "30분 단위로 선택해 주세요." }),
  })
  .partial();

export const PushSubscribe = z.object({
  endpoint: z.url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

export const EventBody = z.object({
  name: z.string(),
  // 원문·숙제 내용은 넣지 않는다(ID만). 값은 짧은 문자열·숫자·불리언만 허용
  props: z.record(z.string(), z.union([z.string().max(100), z.number(), z.boolean()])).default({}),
});

export const DeleteMe = z.object({ confirm: z.string() });

// AI 요약 출력 스키마(FNC-P-003). 숙제 최대 10개
export const SummarySchema = z.object({
  activities: z.array(z.string()),
  child_response: z.string(),
  homework: z
    .array(z.object({ content: z.string().min(1).max(200), frequency: z.string().max(50) }))
    .max(10),
  next_goal: z.string(),
});
export type Summary = z.infer<typeof SummarySchema>;
