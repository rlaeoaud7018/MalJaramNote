import { BottomNav } from "@/components/ui";
import { THERAPY_OPTIONS } from "@/lib/format";
import { requireChild } from "@/lib/page";
import { ProfileRepo } from "@/lib/repo/profile-repo";
import { SettingsView } from "./SettingsView";

// SCR-010 설정
export default async function SettingsPage() {
  const { db, userId, child } = await requireChild();
  const settings = await new ProfileRepo(db).getSettings(userId);
  const therapy = THERAPY_OPTIONS.find((o) => o.value === child.therapyType)?.label ?? "기타";
  return (
    <main className="app">
      <div className="top">
        <h1>설정</h1>
      </div>
      <SettingsView settings={settings} childSummary={`${child.nickname} · ${therapy}${child.centerName ? ` · ${child.centerName}` : ""}`} />
      <BottomNav />
    </main>
  );
}
