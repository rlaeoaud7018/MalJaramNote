import Link from "next/link";
import { BottomNav, Sprout } from "@/components/ui";
import { formatDate, STATUS_LABEL } from "@/lib/format";
import { requireChild } from "@/lib/page";
import { HomeworkRepo } from "@/lib/repo/homework-repo";
import { SessionRepo } from "@/lib/repo/session-repo";
import { WeekHomework } from "./WeekHomework";

// SCR-003 홈: 이번 주 숙제 + 최근 회기 3개
export default async function HomePage() {
  const { db, userId, child } = await requireChild();
  const [homework, recent] = await Promise.all([
    new HomeworkRepo(db).listByRange(userId, "this_week"),
    new SessionRepo(db).list(child.id, 3, null),
  ]);

  return (
    <main className="app">
      <div className="top">
        <span className="brand">
          <Sprout /> 말자람 노트
        </span>
        <span className="hint" style={{ margin: 0 }}>{child.nickname}의 기록</span>
      </div>

      <h2 className="section">
        이번 주 숙제 <Link href="/homework">모아보기</Link>
      </h2>
      <WeekHomework items={homework} />

      <h2 className="section">
        최근 회기 <Link href="/sessions">전체</Link>
      </h2>
      {recent.items.length ? (
        recent.items.map((s) => {
          const st = STATUS_LABEL[s.status];
          return (
            <Link key={s.id} href={s.status === "DONE" ? `/sessions/${s.id}` : `/sessions/${s.id}/processing`} className="card session-card">
              <div className="date">
                {formatDate(s.sessionDate)} <span className={`badge ${st.cls}`}>{st.text}</span>
              </div>
              <div className="sub">{s.firstActivity ?? (s.status === "DONE" ? "요약을 확인해 보세요" : "정리하고 있어요")}</div>
            </Link>
          );
        })
      ) : (
        <div className="card">
          <p className="empty">아직 기록이 없어요. 오늘 상담을 녹음해 보세요.</p>
        </div>
      )}

      <Link href="/record" className="btn fab">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
        </svg>
        상담 녹음하기
      </Link>
      <BottomNav />
    </main>
  );
}
