"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { THERAPY_OPTIONS } from "@/lib/format";
import { errorMessage } from "./ui";

export type ChildValues = { id?: string; nickname: string; birthMonth: string | null; therapyType: string; centerName: string | null };

function monthBounds() {
  const now = new Date(Date.now() + 9 * 3600_000); // KST
  const max = now.toISOString().slice(0, 7);
  const min = `${now.getUTCFullYear() - 12}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return { min, max };
}

// SCR-002 아이 프로필 등록 / 설정에서 수정 모드로 재사용
export function ChildForm({ initial }: { initial?: ChildValues }) {
  const router = useRouter();
  const edit = !!initial?.id;
  const [v, setV] = useState<ChildValues>(initial ?? { nickname: "", birthMonth: null, therapyType: "SPEECH", centerName: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const { min, max } = monthBounds();

  const nick = v.nickname.trim();
  const local: Record<string, string> = {};
  if (v.nickname && (nick.length < 1 || nick.length > 30)) local.nickname = "1~30자로 입력해 주세요.";
  if ((v.centerName ?? "").length > 50) local.centerName = "50자 이하로 입력해 주세요.";
  if (v.birthMonth && (v.birthMonth > max || v.birthMonth < min)) local.birthMonth = "만 0~12세, 미래가 아닌 월만 선택할 수 있어요.";
  const shown = { ...errors, ...local };
  const canSubmit = nick.length >= 1 && !Object.keys(local).length && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setErrors({});
    const res = await fetch(edit ? `/api/children/${initial!.id}` : "/api/children", {
      method: edit ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nickname: nick, birthMonth: v.birthMonth || null, therapyType: v.therapyType, centerName: v.centerName?.trim() || null }),
    }).catch(() => null);
    if (res?.ok || res?.status === 409) {
      router.replace(edit ? "/settings" : "/");
      router.refresh();
      return;
    }
    const err = res ? await errorMessage(res) : { message: "네트워크를 확인해 주세요." };
    setErrors(err.fieldErrors ?? { _: err.message });
    setBusy(false);
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="nickname">아이 별칭</label>
        <input id="nickname" className={`input${shown.nickname ? " invalid" : ""}`} maxLength={30} value={v.nickname}
          onChange={(e) => setV({ ...v, nickname: e.target.value })} placeholder="예: 도윤이" autoComplete="off" />
        <p className="hint">실명 대신 집에서 부르는 이름을 적어 주세요. 받아쓰기 정확도를 높이는 데 써요.</p>
        {shown.nickname && <p className="error-text">{shown.nickname}</p>}
      </div>
      <div className="field">
        <label htmlFor="birthMonth">생년월 (선택)</label>
        <input id="birthMonth" type="month" className={`input${shown.birthMonth ? " invalid" : ""}`} min={min} max={max}
          value={v.birthMonth ?? ""} onChange={(e) => setV({ ...v, birthMonth: e.target.value || null })} />
        {shown.birthMonth && <p className="error-text">{shown.birthMonth}</p>}
      </div>
      <div className="field">
        <label id="therapy-label">치료 종류</label>
        <div className="chips" role="group" aria-labelledby="therapy-label">
          {THERAPY_OPTIONS.map((o) => (
            <button type="button" key={o.value} className="chip" aria-pressed={v.therapyType === o.value}
              onClick={() => setV({ ...v, therapyType: o.value })}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label htmlFor="centerName">치료실명 (선택)</label>
        <input id="centerName" className={`input${shown.centerName ? " invalid" : ""}`} value={v.centerName ?? ""}
          onChange={(e) => setV({ ...v, centerName: e.target.value })} placeholder="예: 해솔언어발달센터" />
        {shown.centerName && <p className="error-text">{shown.centerName}</p>}
      </div>
      {shown._ && <p className="error-text" role="alert">{shown._}</p>}
      <button className="btn" style={{ marginTop: 28 }} disabled={!canSubmit}>
        {busy ? "저장 중…" : edit ? "저장하기" : "시작하기"}
      </button>
    </form>
  );
}
