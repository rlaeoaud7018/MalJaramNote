import { notFound, redirect } from "next/navigation";
import { BackLink } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { requireChild } from "@/lib/page";
import { SessionRepo } from "@/lib/repo/session-repo";
import { ApiError } from "@/lib/validation/api-error";
import { EditForm } from "./EditForm";

// SCR-007 요약 수정
export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await requireChild();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await new SessionRepo(db).get(id).catch((e) => {
    if (e instanceof ApiError) notFound();
    throw e;
  });
  if (d.status !== "DONE" || !d.summary) redirect(`/sessions/${id}/processing`);

  return (
    <main className="app no-nav">
      <div className="top">
        <BackLink href={`/sessions/${id}`} label="취소" />
        <h1>요약 수정</h1>
        <span style={{ width: 48 }} />
      </div>
      <p className="hint" style={{ marginTop: -8, marginBottom: 8 }}>{formatDate(d.sessionDate)} 회기</p>
      <EditForm
        sessionId={id}
        initial={{
          activities: d.summary.activities.join("\n"),
          childResponse: d.summary.childResponse,
          nextGoal: d.summary.nextGoal,
          homework: d.homework.map((h) => ({ id: h.id, content: h.content, frequency: h.frequency ?? "", isDone: h.isDone })),
        }}
      />
    </main>
  );
}
