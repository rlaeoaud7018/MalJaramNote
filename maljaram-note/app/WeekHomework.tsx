"use client";
import { useState } from "react";
import { HomeworkList, type HomeworkItem } from "@/components/HomeworkList";

// 진행률은 체크할 때마다 바로 갱신
export function WeekHomework({ items }: { items: HomeworkItem[] }) {
  const [list, setList] = useState(items);
  const done = list.filter((h) => h.isDone).length;
  return (
    <div className="card">
      {list.length > 0 && (
        <>
          <div className="progress-row">
            <span>완료</span>
            <span>
              <b>{done}</b> / {list.length}
            </span>
          </div>
          <div className="progress" aria-label={`숙제 ${list.length}개 중 ${done}개 완료`}>
            <span style={{ width: `${(done / list.length) * 100}%` }} />
          </div>
        </>
      )}
      <div style={{ marginTop: list.length ? 8 : 0 }}>
        <HomeworkList items={items} empty="이번 주 숙제가 없어요" onChange={setList} />
      </div>
    </div>
  );
}
