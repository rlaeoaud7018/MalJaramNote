"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { HomeworkList, type HomeworkItem } from "@/components/HomeworkList";
import { formatDate, formatDuration } from "@/lib/format";
import { EventTracker } from "@/lib/push/event-tracker";

type Detail = {
  id: string;
  sessionDate: string;
  durationSec: number | null;
  summary: { activities: string[]; childResponse: string; nextGoal: string; edited: boolean } | null;
  homework: HomeworkItem[];
  transcript: string | null;
  hasAudio: boolean;
};

const MISSING = "녹음에서 찾지 못했어요";

export function SessionDetailView({ detail }: { detail: Detail }) {
  const [tab, setTab] = useState<"summary" | "transcript">("summary");
  const s = detail.summary;

  useEffect(() => {
    EventTracker.track("summary_viewed", { sessionId: detail.id });
  }, [detail.id]);

  return (
    <>
      <h1 style={{ fontSize: 22, fontWeight: 800 }}>{formatDate(detail.sessionDate)}</h1>
      <p className="hint" style={{ marginTop: 2 }}>
        {formatDuration(detail.durationSec) || "녹음 길이 정보 없음"}
        {s?.edited && <span className="badge edited" style={{ marginLeft: 8 }}>수정됨</span>}
      </p>

      <div className="tabs" role="tablist" style={{ marginTop: 16 }}>
        <button role="tab" aria-selected={tab === "summary"} onClick={() => setTab("summary")}>요약</button>
        <button role="tab" aria-selected={tab === "transcript"} onClick={() => setTab("transcript")}>원문</button>
      </div>

      {tab === "summary" ? (
        <>
          <div className="card">
            <h3>오늘 한 활동</h3>
            {s?.activities.length ? (
              <ul>{s.activities.map((a, i) => <li key={i}>{a}</li>)}</ul>
            ) : (
              <p className="empty">{MISSING}</p>
            )}
          </div>
          <div className="card">
            <h3>아이 반응</h3>
            <p className={s?.childResponse ? undefined : "empty"}>{s?.childResponse || MISSING}</p>
          </div>
          <div className="card">
            <h3>집에서 할 숙제</h3>
            <HomeworkList items={detail.homework} empty="이번 회기 숙제가 없어요" />
          </div>
          <div className="card">
            <h3>다음 목표</h3>
            <p className={s?.nextGoal ? undefined : "empty"}>{s?.nextGoal || MISSING}</p>
          </div>
          <p className="hint" style={{ marginTop: 14 }}>
            AI가 상담 녹음을 정리한 내용이에요. 다른 부분이 있으면 직접 고쳐 주세요.
          </p>
          <Link href={`/sessions/${detail.id}/edit`} className="btn secondary" style={{ marginTop: 14 }}>
            요약 수정
          </Link>
        </>
      ) : (
        <>
          <AudioPlayer sessionId={detail.id} hasAudio={detail.hasAudio} />
          <div className="card">
            <h3>받아쓰기 원문</h3>
            <p className="transcript">{detail.transcript || "원문이 없어요."}</p>
          </div>
        </>
      )}
    </>
  );
}

// 재생 URL은 5분짜리라 탭을 열 때 받고, 만료로 실패하면 다시 받는다
function AudioPlayer({ sessionId, hasAudio }: { sessionId: string; hasAudio: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function load() {
    const res = await fetch(`/api/sessions/${sessionId}`).catch(() => null);
    const body = res?.ok ? await res.json() : null;
    if (body?.audioUrl) setUrl(body.audioUrl);
    else setFailed(true);
  }

  useEffect(() => {
    if (hasAudio) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAudio]);

  if (!hasAudio) return <p className="banner">음성 원본은 요약 후 삭제되었어요.</p>;
  return (
    <div className="card">
      <h3>상담 녹음</h3>
      {url ? (
        <audio controls src={url} style={{ width: "100%" }} onError={() => { setUrl(null); void load(); }} />
      ) : failed ? (
        <p className="empty">녹음을 불러오지 못했어요.</p>
      ) : (
        <p className="empty">불러오는 중…</p>
      )}
    </div>
  );
}
