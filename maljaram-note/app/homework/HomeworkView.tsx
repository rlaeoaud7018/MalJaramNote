"use client";
import { useEffect, useState } from "react";
import { HomeworkList, type HomeworkItem } from "@/components/HomeworkList";
import { useToast } from "@/components/ui";
import { EventTracker } from "@/lib/push/event-tracker";
import { PushRegistrar } from "@/lib/push/push-registrar";

type Range = "this_week" | "last_week" | "all";
const TABS: { value: Range; label: string; empty: string }[] = [
  { value: "this_week", label: "이번 주", empty: "이번 주 숙제가 없어요" },
  { value: "last_week", label: "지난 주", empty: "지난 주 숙제가 없어요" },
  { value: "all", label: "전체", empty: "아직 숙제가 없어요" },
];

export function HomeworkView({ initial, notifyOn, fromPush }: { initial: HomeworkItem[]; notifyOn: boolean; fromPush: boolean }) {
  const [range, setRange] = useState<Range>("this_week");
  const [items, setItems] = useState(initial);
  const [list, setList] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [showBanner, setShowBanner] = useState(!notifyOn);
  const [toast, show] = useToast();

  useEffect(() => {
    if (fromPush) EventTracker.track("reminder_clicked");
  }, [fromPush]);

  async function select(r: Range) {
    setRange(r);
    setLoading(true);
    const res = await fetch(`/api/homework?range=${r}`).catch(() => null);
    if (res?.ok) {
      const body = (await res.json()) as { items: HomeworkItem[] };
      setItems(body.items);
      setList(body.items);
    } else show("불러오지 못했어요.");
    setLoading(false);
  }

  // FNC-A-019: 알림 켜기 → 권한·구독 → 설정 ON
  async function enableNotify() {
    const r = await new PushRegistrar().register();
    if (r === "ok") {
      await fetch("/api/me/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ notifyHomework: true }) });
      setShowBanner(false);
      show("설정한 시각(기본 저녁 8시)에 남은 숙제를 알려 드릴게요");
    } else if (r === "ios-not-installed") show("아이폰은 공유 → '홈 화면에 추가' 후 앱에서 알림을 켤 수 있어요");
    else if (r === "denied") show("알림 권한이 꺼져 있어요. 브라우저 설정에서 허용해 주세요");
    else show("이 브라우저에서는 알림을 켤 수 없어요");
  }

  const done = list.filter((h) => h.isDone).length;
  const tab = TABS.find((t) => t.value === range)!;

  return (
    <>
      {showBanner && (
        <div className="banner">
          <span>숙제를 잊지 않게 저녁에 알려 드릴까요?</span>
          <button className="chip" onClick={enableNotify}>알림 켜기</button>
        </div>
      )}
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.value} role="tab" aria-selected={range === t.value} onClick={() => select(t.value)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="card">
        {list.length > 0 && (
          <>
            <div className="progress-row">
              <span>{tab.label} 완료</span>
              <span><b>{done}</b> / {list.length}</span>
            </div>
            <div className="progress"><span style={{ width: `${(done / list.length) * 100}%` }} /></div>
          </>
        )}
        <div style={{ marginTop: list.length ? 8 : 0, opacity: loading ? 0.5 : 1 }}>
          <HomeworkList items={items} showSource empty={tab.empty} onChange={setList} />
        </div>
      </div>
      {toast}
    </>
  );
}
