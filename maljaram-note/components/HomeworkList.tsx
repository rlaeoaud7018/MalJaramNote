"use client";
import Link from "next/link";
import { useState } from "react";
import { formatDate } from "@/lib/format";
import { useToast } from "./ui";

export type HomeworkItem = { id: string; sessionId: string; sessionDate: string; content: string; frequency: string | null; isDone: boolean };

// FNC-A-015: 숙제 체크(낙관적 업데이트, 실패 시 되돌림 + 토스트)
export function HomeworkList({
  items,
  showSource = false,
  empty,
  onChange,
}: {
  items: HomeworkItem[];
  showSource?: boolean;
  empty: string;
  onChange?: (items: HomeworkItem[]) => void;
}) {
  const [list, setList] = useState(items);
  const [toast, show] = useToast();
  const [prevItems, setPrevItems] = useState(items);
  if (items !== prevItems) {
    setPrevItems(items);
    setList(items);
  }

  const update = (next: HomeworkItem[]) => {
    setList(next);
    onChange?.(next);
  };

  async function toggle(h: HomeworkItem) {
    const before = list;
    update(list.map((x) => (x.id === h.id ? { ...x, isDone: !h.isDone } : x)));
    const res = await fetch(`/api/homework/${h.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isDone: !h.isDone }),
    }).catch(() => null);
    if (!res?.ok) {
      update(before);
      show("저장하지 못했어요. 다시 눌러 주세요.");
    }
  }

  if (!list.length) return <p className="empty">{empty}</p>;
  return (
    <>
      <div>
        {list.map((h) => (
          <div className="hw" key={h.id}>
            <input type="checkbox" id={`hw-${h.id}`} checked={h.isDone} onChange={() => toggle(h)} aria-label={h.content} />
            <div className="text">
              <label htmlFor={`hw-${h.id}`} className={h.isDone ? "done" : undefined}>
                {h.content}
              </label>
              <div className="meta">
                {h.frequency && <span className="freq">{h.frequency}</span>}
                {showSource && h.sessionDate && <Link href={`/sessions/${h.sessionId}`}>{formatDate(h.sessionDate)} 회기</Link>}
              </div>
            </div>
          </div>
        ))}
      </div>
      {toast}
    </>
  );
}
