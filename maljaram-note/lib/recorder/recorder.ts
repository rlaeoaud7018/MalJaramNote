// FNC-A-006: MediaRecorder 녹음. 최대 15분, 넘으면 자동 종료
export const MAX_RECORD_SEC = 15 * 60;

// iOS Safari는 webm을 못 만들므로 mp4로 대체
function pickMime(): string {
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

export type RecorderState = "idle" | "recording" | "paused" | "stopped";

export class Recorder {
  private media: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private elapsed = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private done: ((b: Blob) => void) | null = null;
  state: RecorderState = "idle";

  constructor(private onTick: (sec: number) => void, private onAutoStop: (b: Blob) => void) {}

  // 마이크 권한은 이 시점(버튼 클릭)에 요청된다. 거부되면 NotAllowedError
  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const mimeType = pickMime();
    this.media = new MediaRecorder(this.stream, mimeType ? { mimeType, audioBitsPerSecond: 64_000 } : undefined);
    this.chunks = [];
    this.media.ondataavailable = (e) => e.data.size > 0 && this.chunks.push(e.data);
    this.media.onstop = () => {
      const blob = new Blob(this.chunks, { type: (this.media?.mimeType || "audio/webm").split(";")[0] });
      this.stream?.getTracks().forEach((t) => t.stop());
      this.done?.(blob);
    };
    this.media.start(1000);
    this.state = "recording";
    this.elapsed = 0;
    this.timer = setInterval(() => {
      if (this.state !== "recording") return;
      this.elapsed++;
      this.onTick(this.elapsed);
      if (this.elapsed >= MAX_RECORD_SEC) void this.stop().then(this.onAutoStop);
    }, 1000);
  }

  pause(): void {
    if (this.state !== "recording") return;
    this.media?.pause();
    this.state = "paused";
  }

  resume(): void {
    if (this.state !== "paused") return;
    this.media?.resume();
    this.state = "recording";
  }

  stop(): Promise<Blob> {
    if (this.timer) clearInterval(this.timer);
    this.state = "stopped";
    return new Promise((resolve) => {
      this.done = resolve;
      this.media?.stop();
    });
  }

  get extension(): string {
    return this.media?.mimeType.startsWith("audio/mp4") ? "m4a" : "webm";
  }
}
