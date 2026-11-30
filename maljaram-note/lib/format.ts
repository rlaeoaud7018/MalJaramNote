const DOW = ["일", "월", "화", "수", "목", "금", "토"];

// '12월 8일 (월)'
export function formatDate(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${DOW[d.getUTCDay()]})`;
}

// '2026년 12월'
export const formatMonth = (ymd: string) => `${ymd.slice(0, 4)}년 ${Number(ymd.slice(5, 7))}월`;

// '8분 6초'
export function formatDuration(sec: number | null): string {
  if (sec == null) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m}분 ${s}초` : `${s}초`;
}

export const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  DONE: { text: "요약 완료", cls: "" },
  UPLOADED: { text: "처리 중", cls: "wait" },
  TRANSCRIBING: { text: "처리 중", cls: "wait" },
  SUMMARIZING: { text: "처리 중", cls: "wait" },
  FAILED: { text: "실패", cls: "fail" },
};

export const THERAPY_OPTIONS = [
  { value: "SPEECH", label: "언어" },
  { value: "PLAY", label: "놀이" },
  { value: "SENSORY", label: "감각통합" },
  { value: "ETC", label: "기타" },
] as const;
