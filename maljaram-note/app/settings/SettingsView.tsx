"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessage, Modal, useToast } from "@/components/ui";
import { PushRegistrar } from "@/lib/push/push-registrar";
import type { Settings } from "@/lib/repo/profile-repo";

const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);

export function SettingsView({ settings, childSummary }: { settings: Settings; childSummary: string }) {
  const router = useRouter();
  const [s, setS] = useState(settings);
  const [withdraw, setWithdraw] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, show] = useToast();

  // FNC-A-017: 바꾸면 바로 저장, 실패하면 되돌림
  async function save(patch: Partial<Settings>, msg: string) {
    const before = s;
    setS({ ...s, ...patch });
    const res = await fetch("/api/me/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => null);
    if (res?.ok) show(msg);
    else {
      setS(before);
      show("저장하지 못했어요");
    }
  }

  async function toggleNotify(on: boolean) {
    if (on) {
      const r = await new PushRegistrar().register();
      if (r !== "ok") {
        show(r === "ios-not-installed" ? "아이폰은 '홈 화면에 추가' 후 알림을 켤 수 있어요" : r === "denied" ? "알림 권한이 거부되어 꺼 둘게요" : "이 브라우저에서는 알림을 켤 수 없어요");
        return;
      }
    }
    await save({ notifyHomework: on }, on ? `매일 ${s.notifyTime}에 알려 드릴게요` : "알림을 껐어요");
  }

  async function deleteAccount() {
    setBusy(true);
    const res = await fetch("/api/me", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm }) }).catch(() => null);
    if (res?.ok) {
      router.replace("/login");
      router.refresh();
      return;
    }
    setBusy(false);
    show(res ? (await errorMessage(res)).message : "네트워크를 확인해 주세요.");
  }

  return (
    <>
      <h2 className="section">아이</h2>
      <Link href="/onboarding?edit=1" className="card session-card">
        <div className="date">{childSummary} <span style={{ color: "var(--muted)" }}>수정 ›</span></div>
      </Link>

      <h2 className="section">데이터</h2>
      <div className="card">
        <label className="toggle-row">
          <span>
            <b>요약 후 음성 원본 자동 삭제</b>
            <span className="hint" style={{ display: "block" }}>끄면 원문 탭에서 녹음을 다시 들을 수 있어요.</span>
          </span>
          <input type="checkbox" className="switch" checked={s.autoDeleteAudio}
            onChange={(e) => save({ autoDeleteAudio: e.target.checked }, e.target.checked ? "요약이 끝나면 음성을 지울게요" : "음성 원본을 보관할게요")} />
        </label>
      </div>

      <h2 className="section">알림</h2>
      <div className="card">
        <label className="toggle-row">
          <b>숙제 알림</b>
          <input type="checkbox" className="switch" checked={s.notifyHomework} onChange={(e) => toggleNotify(e.target.checked)} />
        </label>
        <div className="toggle-row">
          <label htmlFor="notifyTime"><b>알림 시각</b></label>
          <select id="notifyTime" className="input" style={{ width: 120, minHeight: 44 }} value={s.notifyTime} disabled={!s.notifyHomework}
            onChange={(e) => save({ notifyTime: e.target.value }, `매일 ${e.target.value}에 알려 드릴게요`)}>
            {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <h2 className="section">계정</h2>
      <div className="card">
        <p className="hint" style={{ marginTop: 0 }}>{s.nickname ? `${s.nickname}님, 카카오로 로그인했어요` : "카카오로 로그인했어요"}</p>
        <form action="/auth/signout" method="post" style={{ marginTop: 12 }}>
          <button className="btn ghost">로그아웃</button>
        </form>
      </div>
      <p style={{ textAlign: "center", marginTop: 18 }}>
        <button className="link-btn danger" onClick={() => setWithdraw(true)}>회원 탈퇴</button>
      </p>

      {withdraw && (
        <Modal title="정말 탈퇴할까요?" onClose={() => setWithdraw(false)}>
          <p>녹음, 요약, 숙제, 아이 정보가 바로 지워지고 되돌릴 수 없어요. 계속하려면 아래에 <b>탈퇴</b>를 입력해 주세요.</p>
          <input className="input" style={{ marginTop: 12 }} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="탈퇴" aria-label="확인 문구" />
          <div className="row">
            <button className="btn ghost" onClick={() => setWithdraw(false)}>취소</button>
            <button className="btn danger" disabled={confirm !== "탈퇴" || busy} onClick={deleteAccount}>{busy ? "삭제 중…" : "탈퇴"}</button>
          </div>
        </Modal>
      )}
      {toast}
    </>
  );
}
