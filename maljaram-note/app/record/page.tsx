import { BackLink } from "@/components/ui";
import { requireChild } from "@/lib/page";
import { RecordScreen } from "./RecordScreen";

// SCR-004 녹음
export default async function RecordPage() {
  const { child } = await requireChild();
  return (
    <main className="app no-nav">
      <div className="top">
        <BackLink href="/" label="홈" />
        <h1>상담 녹음</h1>
        <span style={{ width: 48 }} />
      </div>
      <RecordScreen childId={child.id} />
    </main>
  );
}
