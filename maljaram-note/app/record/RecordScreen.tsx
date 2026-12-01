"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { EventTracker } from "@/lib/push/event-tracker";
import { MAX_RECORD_SEC, Recorder } from "@/lib/recorder/recorder";
import { UploadError, UploadQueue, type PendingUpload } from "@/lib/recorder/upload-queue";
import { WakeLockGuard } from "@/lib/recorder/wake-lock";
import { useToast } from "@/components/ui";

const MAX_BYTES = 25 * 1024 * 1024;
const FILE_TYPES: Record<string, string> = { m4a: "audio/mp4", mp4: "audio/mp4", mp3: "audio/mpeg", webm: "audio/webm" };

function kstToday(offsetDays = 0): string {
  return new Date(Date.now() + 9 * 3600_000 + offsetDays * 86400_000).toISOString().slice(0, 10);
}
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

// 다시 시도해도 같은 결과가 나오는 오류는 보관본을 지운다
const PERMANENT = new Set(["QUOTA_EXCEEDED", "FILE_TOO_LARGE", "INVALID_INPUT", "CONSENT_REQUIRED", "CHILD_NOT_FOUND"]);

export function RecordScreen({ childId }: { childId: string }) {
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [date, setDate] = useState(kstToday());
  const [state, setState] = useState<"idle" | "recording" | "paused" | "uploading">("idle");
  const [sec, setSec] = useState(0);
  const [pct, setPct] = useState(0);
  const [wakeMsg, setWakeMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [toast, show] = useToast();
  const recorder = useRef<Recorder | null>(null);
  const wake = useRef<WakeLockGuard | null>(null);
  const queue = useRef(new UploadQueue());

  useEffect(() => {
    queue.current.list().then(setPending).catch(() => {});
    return () => wake.current?.release();
  }, []);

  async function send(item: PendingUpload, recorded: boolean) {
    setState("uploading");
    setPct(0);
    setError(null);
    try {
      const id = await queue.current.upload(item, setPct);
      router.push(`/sessions/${id}/processing`);
    } catch (e) {
      const err = e instanceof UploadError ? e : new UploadError(0);
      if (err.code && PERMANENT.has(err.code)) await queue.current.remove(item.key);
      if (recorded) EventTracker.track("recording_failed", { reason: err.code ?? "upload" });
      setError(err.message);
      setPending(await queue.current.list().catch(() => []));
      setState("idle");
    }
  }

  async function finish(blob: Blob) {
    wake.current?.release();
    setWakeMsg(null);
    const ext = recorder.current?.extension ?? "webm";
    const key = await queue.current.enqueue({ blob, fileName: `rec.${ext}`, sessionDate: date, childId });
    const item = (await queue.current.list()).find((p) => p.key === key)!;
    await send(item, true);
  }

  async function start() {
    setError(null);
    const r = new Recorder(setSec, (b) => void finish(b));
    try {
      await r.start();
    } catch (e) {
      const denied = (e as Error).name === "NotAllowedError";
      setError(denied ? "마이크 권한이 꺼져 있어요. 브라우저 설정에서 마이크를 허용해 주세요." : "녹음을 시작하지 못했어요. 파일 올리기를 이용해 주세요.");
      EventTracker.track("recording_failed", { reason: denied ? "permission" : "start" });
      return;
    }
    recorder.current = r;
    setSec(0);
    setState("recording");
    EventTracker.track("recording_started");
    wake.current = new WakeLockGuard(show);
    const ok = await wake.current.acquire();
    setWakeMsg(ok ? "녹음 중에는 화면이 꺼지지 않아요" : "녹음이 끝날 때까지 화면을 켜 두세요");
  }

  function pauseResume() {
    if (state === "recording") {
      recorder.current?.pause();
      setState("paused");
    } else {
      recorder.current?.resume();
      setState("recording");
    }
  }

  async function stop() {
    const blob = await recorder.current!.stop();
    await finish(blob);
  }

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    const type = FILE_TYPES[ext];
    if (!type) return setError("m4a·mp3·webm 파일만 올릴 수 있어요.");
    if (f.size > MAX_BYTES) return setError("25MB 이하 파일만 올릴 수 있어요.");
    const blob = new Blob([f], { type });
    const key = await queue.current.enqueue({ blob, fileName: `upload.${ext}`, sessionDate: date, childId });
    const item = (await queue.current.list()).find((p) => p.key === key)!;
    await send(item, false);
  }

  const busy = state !== "idle";
  const left = MAX_RECORD_SEC - sec;

  return (
    <>
      {pending.length > 0 && state === "idle" && (
        <div className="banner warn">
          <span>올리지 못한 녹음이 {pending.length}개 있어요</span>
          <button className="chip" onClick={() => send(pending[0], true)}>
            다시 올리기
          </button>
        </div>
      )}

      <div className="card">
        <label className="consent">
          <input type="checkbox" checked={consent} disabled={busy} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            <b>치료사 선생님께 녹음 동의를 받았어요</b>
            <span className="hint" style={{ display: "block" }}>동의 없이 녹음한 회기는 저장할 수 없어요.</span>
          </span>
        </label>
        <div className="field">
          <label htmlFor="date">회기 날짜</label>
          <input id="date" type="date" className="input" value={date} min={kstToday(-30)} max={kstToday()} disabled={busy}
            onChange={(e) => e.target.value && setDate(e.target.value)} />
        </div>
      </div>

      <div className={`rec-timer${sec >= MAX_RECORD_SEC - 10 ? " warn" : ""}`} aria-live="off">
        {mmss(sec)} <span style={{ fontSize: 18, color: "var(--muted)", fontWeight: 600 }}>/ 15:00</span>
      </div>
      {state === "recording" && left <= 60 && <p className="hint" style={{ textAlign: "center" }}>{left}초 뒤 자동으로 끝나요</p>}
      {wakeMsg && <p className="hint" style={{ textAlign: "center" }}>{wakeMsg}</p>}

      {state === "uploading" ? (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="progress-row">
            <span>올리는 중</span>
            <b>{pct}%</b>
          </div>
          <div className="progress">
            <span style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : (
        <div className="rec-btns">
          {state === "idle" ? (
            <button className="rec-main" onClick={start} disabled={!consent}>
              녹음
            </button>
          ) : (
            <>
              <button className="chip" onClick={pauseResume}>
                {state === "paused" ? "계속" : "일시정지"}
              </button>
              <button className="rec-main recording" onClick={stop}>
                종료
              </button>
            </>
          )}
        </div>
      )}

      {error && <p className="error-text" role="alert" style={{ textAlign: "center", marginTop: 14 }}>{error}</p>}

      {state === "idle" && (
        <p style={{ textAlign: "center", marginTop: 26 }}>
          <label className={`link-btn${consent ? "" : " disabled"}`} style={{ opacity: consent ? 1 : 0.45, cursor: consent ? "pointer" : "not-allowed" }}>
            녹음 파일 올리기 (m4a·mp3·webm, 25MB 이하)
            <input type="file" accept=".m4a,.mp3,.webm,.mp4,audio/*" className="sr-only" disabled={!consent} onChange={pickFile} />
          </label>
        </p>
      )}
      {toast}
    </>
  );
}
