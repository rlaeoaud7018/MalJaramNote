// 클라이언트 이벤트 기록(FNC-O-001). 실패해도 화면 동작에는 영향을 주지 않는다
export type EventName =
  | "recording_started"
  | "recording_failed"
  | "session_uploaded"
  | "summary_viewed"
  | "summary_edited"
  | "homework_checked"
  | "reminder_clicked";

export const EventTracker = {
  track(name: EventName, props: Record<string, string | number | boolean> = {}): void {
    void fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, props }),
      keepalive: true,
    }).catch(() => {});
  },
};
