import { BottomNav } from "@/components/ui";
import { requireChild } from "@/lib/page";
import { SessionRepo } from "@/lib/repo/session-repo";
import { Timeline } from "./Timeline";

// SCR-008 회기 타임라인
export default async function SessionsPage() {
  const { db, child } = await requireChild();
  const first = await new SessionRepo(db).list(child.id, 20, null);
  return (
    <main className="app">
      <div className="top">
        <h1>회기 기록</h1>
      </div>
      <Timeline childId={child.id} initial={first} />
      <BottomNav />
    </main>
  );
}
