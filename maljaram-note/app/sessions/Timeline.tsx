"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatDate, formatMonth, STATUS_LABEL } from "@/lib/format";

type Item = { id: string; sessionDate: string; status: string; firstActivity: string | null };
type Page = { items: Item[]; nextCursor: string | null };

// 20개씩 무한 스크롤, 월 헤더
export function Timeline({ childId, initial }: { childId: string; initial: Page }) {
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cursor || !sentinel.current) return;
    const io = new IntersectionObserver(async ([e]) => {
      if (!e.isIntersecting || loading) return;
      setLoading(true);
      const res = await fetch(`/api/sessions?childId=${childId}&cursor=${encodeURIComponent(cursor)}`).catch(() => null);
      if (res?.ok) {
        const page = (await res.json()) as Page;
        setItems((l) => [...l, ...page.items]);
        setCursor(page.nextCursor);
      }
      setLoading(false);
    });
    io.observe(sentinel.current);
    return () => io.disconnect();
  }, [cursor, childId, loading]);

  if (!items.length) {
    return (
      <div className="card">
        <p className="empty">아직 회기가 없어요.</p>
        <Link href="/record" className="btn" style={{ marginTop: 14 }}>첫 상담 녹음하기</Link>
      </div>
    );
  }

  let lastMonth = "";
  return (
    <>
      {items.map((s) => {
        const month = s.sessionDate.slice(0, 7);
        const header = month !== lastMonth ? <p className="month">{formatMonth(s.sessionDate)}</p> : null;
        lastMonth = month;
        const st = STATUS_LABEL[s.status] ?? STATUS_LABEL.UPLOADED;
        return (
          <div key={s.id}>
            {header}
            <Link href={s.status === "DONE" ? `/sessions/${s.id}` : `/sessions/${s.id}/processing`} className="card session-card" style={{ marginBottom: 10 }}>
              <div className="date">
                {formatDate(s.sessionDate)} <span className={`badge ${st.cls}`}>{st.text}</span>
              </div>
              {s.firstActivity && <div className="sub">{s.firstActivity}</div>}
            </Link>
          </div>
        );
      })}
      <div ref={sentinel} style={{ height: 1 }} />
      {loading && <p className="hint" style={{ textAlign: "center" }}>불러오는 중…</p>}
    </>
  );
}
