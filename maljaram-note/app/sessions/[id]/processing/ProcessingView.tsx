"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { StatusPoller, type StatusResponse } from "@/lib/recorder/status-poller";

type S = StatusResponse & { audioDeleted?: boolean };
const ORDER = ["UPLOADED", "TRANSCRIBING", "SUMMARIZING", "DONE"]; // 0~3
const STEPS = [
  { at: 1, label: "올리기" },
  { at: 2, label: "받아쓰기" },
  { at: 3, label: "요약하기" },
];
const SLOW_MS = 5 * 60 * 1000;

// FNC-A-010 · FNC-P-006: 3초 폴링, 완료되면 상세로, 실패하면 다시 시도
export function ProcessingView({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [s, setS] = useState<S | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [slow, setSlow] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const stageSince = useRef<{ status: string; at: number } | null>(null);
  const poller = useRef<StatusPoller | null>(null);

  function startPolling() {
    poller.current?.stop();
    poller.current = new StatusPoller(sessionId, (next) => {
      setS(next);
      if (stageSince.current?.status !== next.status) stageSince.current = { status: next.status, at: Date.now() };
      setSlow(Date.now() - stageSince.current.at > SLOW_MS);
      if (next.status === "DONE") router.replace(`/sessions/${sessionId}`);
    });
    poller.current.start();
  }

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}/status`).then((r) => r.status === 404 && setNotFound(true)).catch(() => {});
    startPolling();
    return () => poller.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function retry() {
    setRetrying(true);
    const res = await fetch(`/api/sessions/${sessionId}/process`, { method: "POST" }).catch(() => null);
    setRetrying(false);
    if (res && (res.ok || res.status === 409)) {
      setS((p) => (p ? { ...p, status: "TRANSCRIBING", errorMessage: null } : p));
      startPolling();
    }
  }

  if (notFound) return <p className="empty">회기를 찾을 수 없어요.</p>;
  const idx = s ? ORDER.indexOf(s.status) : 1;
  const failed = s?.status === "FAILED";

  return (
    <div className="card">
      <ol className="steps">
        {STEPS.map((st) => {
          // 이 화면에 왔다면 올리기는 끝났다. UPLOADED는 받아쓰기 대기로 본다
          const cur = Math.max(idx, 1) + 1;
          const cls = st.at === 1 || (!failed && st.at < cur) ? "done" : !failed && st.at === cur ? "now" : "";
          return (
            <li key={st.label} className={cls}>
              <span className="dot">{cls === "done" ? "✓" : ""}</span>
              {st.label}
            </li>
          );
        })}
      </ol>
      {!failed && <p className="hint">10분 녹음 기준 1~2분 걸려요. 이 화면을 나가도 정리는 계속돼요.</p>}
      {slow && !failed && <p className="error-text">평소보다 오래 걸리고 있어요. 조금만 더 기다려 주세요.</p>}
      {failed && (
        <div style={{ marginTop: 12 }}>
          <p className="error-text" role="alert">{s?.errorMessage ?? "처리하지 못했어요."}</p>
          {s?.audioDeleted ? (
            <p className="hint">음성 원본이 삭제되어 다시 처리할 수 없어요.</p>
          ) : (
            <button className="btn" style={{ marginTop: 14 }} onClick={retry} disabled={retrying}>
              {retrying ? "다시 시작하는 중…" : "다시 시도"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
