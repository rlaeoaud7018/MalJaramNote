import { BottomNav } from "@/components/ui";
import { requireChild } from "@/lib/page";
import { HomeworkRepo } from "@/lib/repo/homework-repo";
import { ProfileRepo } from "@/lib/repo/profile-repo";
import { HomeworkView } from "./HomeworkView";

// SCR-009 숙제 모아보기
export default async function HomeworkPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  const { db, userId } = await requireChild();
  const [items, settings] = await Promise.all([
    new HomeworkRepo(db).listByRange(userId, "this_week"),
    new ProfileRepo(db).getSettings(userId),
  ]);
  return (
    <main className="app">
      <div className="top">
        <h1>숙제 모아보기</h1>
      </div>
      <HomeworkView initial={items} notifyOn={settings.notifyHomework} fromPush={from === "push"} />
      <BottomNav />
    </main>
  );
}
