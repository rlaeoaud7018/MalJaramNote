// 모든 날짜 계산은 KST(UTC+9, 일광절약 없음) 기준
const KST_MS = 9 * 60 * 60 * 1000;

function kst(now: Date): Date {
  return new Date(now.getTime() + KST_MS);
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export function todayKst(now = new Date()): string {
  return ymd(kst(now));
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return ymd(d);
}

export type Range = "this_week" | "last_week" | "all";

// 숙제 기간: 회기 날짜(session_date) 기준 월~일. all이면 null
export function weekRange(range: Range, now = new Date()): { from: string; to: string } | null {
  if (range === "all") return null;
  const today = todayKst(now);
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0=일
  const monday = addDays(today, -((dow + 6) % 7));
  const from = range === "this_week" ? monday : addDays(monday, -7);
  return { from, to: addDays(from, 6) };
}

// Cron 실행 시각을 30분 단위로 내린 KST "HH:MM" (Cron 지연이 있어도 같은 슬롯으로 판정)
export function kstSlot(now = new Date()): string {
  const d = kst(now);
  const h = String(d.getUTCHours()).padStart(2, "0");
  const m = d.getUTCMinutes() < 30 ? "00" : "30";
  return `${h}:${m}`;
}

// 생년월 YYYY-MM → 만 나이(개월 단위 내림)
export function ageInYears(birthMonth: string, now = new Date()): number {
  const [y, m] = birthMonth.split("-").map(Number);
  const t = kst(now);
  const months = (t.getUTCFullYear() - y) * 12 + (t.getUTCMonth() + 1 - m);
  return Math.floor(months / 12);
}
