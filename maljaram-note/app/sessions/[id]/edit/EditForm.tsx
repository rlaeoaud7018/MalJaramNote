"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessage, Modal, useToast } from "@/components/ui";

type Hw = { id?: string; content: string; frequency: string; isDone?: boolean; key: string };
type Initial = { activities: string; childResponse: string; nextGoal: string; homework: Omit<Hw, "key">[] };

let seq = 0;
const k = () => `n${++seq}`;

// FNC-A-013 요약·숙제 수정, FNC-A-014 회기 삭제
export function EditForm({ sessionId, initial }: { sessionId: string; initial: Initial }) {
  const router = useRouter();
  const [activities, setActivities] = useState(initial.activities);
  const [childResponse, setChildResponse] = useState(initial.childResponse);
  const [nextGoal, setNextGoal] = useState(initial.nextGoal);
  const [hw, setHw] = useState<Hw[]>(initial.homework.map((h) => ({ ...h, key: h.id ?? k() })));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirmDone, setConfirmDone] = useState<Hw | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, show] = useToast();

  const local: Record<string, string> = {};
  if (activities.length > 1000) local.activities = "1000자 이하로 입력해 주세요.";
  if (childResponse.length > 1000) local.childResponse = "1000자 이하로 입력해 주세요.";
  if (nextGoal.length > 1000) local.nextGoal = "1000자 이하로 입력해 주세요.";
  hw.forEach((h, i) => {
    if (!h.content.trim() || h.content.length > 200) local[`homework.${i}.content`] = "1~200자로 입력해 주세요.";
    if (h.frequency.length > 50) local[`homework.${i}.frequency`] = "50자 이하로 입력해 주세요.";
  });
  const shown = { ...errors, ...local };

  const setItem = (key: string, patch: Partial<Hw>) => setHw((l) => l.map((h) => (h.key === key ? { ...h, ...patch } : h)));
  const removeItem = (h: Hw) => (h.isDone ? setConfirmDone(h) : setHw((l) => l.filter((x) => x.key !== h.key)));

  async function save() {
    if (Object.keys(local).length) return;
    setBusy(true);
    const res = await fetch(`/api/sessions/${sessionId}/summary`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        activities: activities.split("\n").map((a) => a.trim()).filter(Boolean),
        childResponse: childResponse.trim(),
        nextGoal: nextGoal.trim(),
        homework: hw.map((h) => ({ ...(h.id ? { id: h.id } : {}), content: h.content.trim(), frequency: h.frequency.trim() })),
      }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      show("저장했어요");
      router.replace(`/sessions/${sessionId}`);
      router.refresh();
      return;
    }
    const err = res ? await errorMessage(res) : { message: "네트워크를 확인해 주세요." };
    setErrors(err.fieldErrors ?? {});
    show(err.message);
  }

  async function remove() {
    setBusy(true);
    const res = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) {
      router.replace("/sessions");
      router.refresh();
      return;
    }
    setBusy(false);
    setConfirmDelete(false);
    show(res ? (await errorMessage(res)).message : "네트워크를 확인해 주세요.");
  }

  return (
    <>
      <div className="field">
        <label htmlFor="activities">오늘 한 활동 <span className="hint">(한 줄에 하나)</span></label>
        <textarea id="activities" className={`input${shown.activities ? " invalid" : ""}`} value={activities} onChange={(e) => setActivities(e.target.value)} />
        {shown.activities && <p className="error-text">{shown.activities}</p>}
      </div>
      <div className="field">
        <label htmlFor="childResponse">아이 반응</label>
        <textarea id="childResponse" className={`input${shown.childResponse ? " invalid" : ""}`} value={childResponse} onChange={(e) => setChildResponse(e.target.value)} />
        {shown.childResponse && <p className="error-text">{shown.childResponse}</p>}
      </div>

      <div className="field">
        <label>집에서 할 숙제 <span className="hint">({hw.length}/10)</span></label>
        <div className="stack">
          {hw.map((h, i) => (
            <div className="card" key={h.key} style={{ padding: 14 }}>
              <input className={`input${shown[`homework.${i}.content`] ? " invalid" : ""}`} value={h.content} maxLength={200} placeholder="숙제 내용"
                aria-label={`숙제 ${i + 1} 내용`} onChange={(e) => setItem(h.key, { content: e.target.value })} />
              {shown[`homework.${i}.content`] && <p className="error-text">{shown[`homework.${i}.content`]}</p>}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input className="input" value={h.frequency} maxLength={50} placeholder="빈도 (예: 하루 2번)"
                  aria-label={`숙제 ${i + 1} 빈도`} onChange={(e) => setItem(h.key, { frequency: e.target.value })} />
                <button type="button" className="chip" onClick={() => removeItem(h)} aria-label={`숙제 ${i + 1} 삭제`}>삭제</button>
              </div>
            </div>
          ))}
        </div>
        {hw.length < 10 && (
          <button type="button" className="btn ghost" style={{ marginTop: 10 }}
            onClick={() => setHw((l) => [...l, { content: "", frequency: "", key: k() }])}>
            + 숙제 추가
          </button>
        )}
      </div>

      <div className="field">
        <label htmlFor="nextGoal">다음 목표</label>
        <textarea id="nextGoal" className={`input${shown.nextGoal ? " invalid" : ""}`} value={nextGoal} onChange={(e) => setNextGoal(e.target.value)} />
        {shown.nextGoal && <p className="error-text">{shown.nextGoal}</p>}
      </div>

      <button className="btn" style={{ marginTop: 26 }} onClick={save} disabled={busy || Object.keys(local).length > 0}>
        {busy ? "저장 중…" : "저장"}
      </button>
      <p style={{ textAlign: "center", marginTop: 18 }}>
        <button className="link-btn danger" onClick={() => setConfirmDelete(true)}>이 회기 삭제</button>
      </p>

      {confirmDone && (
        <Modal title="완료한 숙제예요" onClose={() => setConfirmDone(null)}>
          <p>완료 체크한 숙제를 삭제할까요? 진행률에서도 빠져요.</p>
          <div className="row">
            <button className="btn ghost" onClick={() => setConfirmDone(null)}>취소</button>
            <button className="btn danger" onClick={() => { setHw((l) => l.filter((x) => x.key !== confirmDone.key)); setConfirmDone(null); }}>삭제</button>
          </div>
        </Modal>
      )}
      {confirmDelete && (
        <Modal title="회기를 삭제할까요?" onClose={() => setConfirmDelete(false)}>
          <p>요약, 숙제, 원문, 녹음 파일이 모두 지워지고 되돌릴 수 없어요.</p>
          <div className="row">
            <button className="btn ghost" onClick={() => setConfirmDelete(false)}>취소</button>
            <button className="btn danger" onClick={remove} disabled={busy}>삭제</button>
          </div>
        </Modal>
      )}
      {toast}
    </>
  );
}
