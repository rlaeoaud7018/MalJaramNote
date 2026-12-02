import { BackLink } from "@/components/ui";
import { ProcessingView } from "./ProcessingView";

// SCR-005 처리 중
export default async function ProcessingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="app no-nav">
      <div className="top">
        <BackLink href="/" label="홈" />
        <h1>정리하고 있어요</h1>
        <span style={{ width: 48 }} />
      </div>
      <ProcessingView sessionId={id} />
    </main>
  );
}
