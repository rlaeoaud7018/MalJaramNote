// FNC-A-007 (2차 개선, E-07): 녹음 중 화면 꺼짐 방지
export class WakeLockGuard {
  private lock: WakeLockSentinel | null = null;
  private active = false;

  constructor(private warn: (msg: string) => void = () => {}) {}

  async acquire(): Promise<boolean> {
    if (!("wakeLock" in navigator)) return false;
    try {
      this.lock = await navigator.wakeLock.request("screen");
    } catch {
      return false;
    }
    this.active = true;
    document.addEventListener("visibilitychange", this.onVisible);
    return true;
  }

  // 다른 앱에 갔다 오면 잠금이 풀리므로 다시 요청
  private onVisible = async () => {
    if (!this.active || document.visibilityState !== "visible") return;
    this.warn("녹음 중에는 화면을 벗어나지 마세요");
    try {
      this.lock = await navigator.wakeLock.request("screen");
    } catch {
      /* 재요청 실패는 무시: 녹음 자체는 계속된다 */
    }
  };

  release(): void {
    this.active = false;
    document.removeEventListener("visibilitychange", this.onVisible);
    void this.lock?.release();
    this.lock = null;
  }
}
