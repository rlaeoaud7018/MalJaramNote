export type StatusResponse = { status: string; updatedAt: string; errorMessage: string | null };

// FNC-A-010: 3초 간격 폴링. DONE/FAILED이면 멈춘다
export class StatusPoller {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(private sessionId: string, private onStatus: (s: StatusResponse) => void, private intervalMs = 3000) {}

  start(): void {
    this.stopped = false;
    void this.tick();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  private async tick(): Promise<void> {
    try {
      const res = await fetch(`/api/sessions/${this.sessionId}/status`, { cache: "no-store" });
      if (res.ok) {
        const s = (await res.json()) as StatusResponse;
        this.onStatus(s);
        if (s.status === "DONE" || s.status === "FAILED") return this.stop();
      }
    } catch {
      /* 일시적인 네트워크 오류는 다음 주기에 다시 시도 */
    }
    if (!this.stopped) this.timer = setTimeout(() => void this.tick(), this.intervalMs);
  }
}
