import { notFound, redirect } from "next/navigation";
import { BackLink } from "@/components/ui";
import { requireChild } from "@/lib/page";
import { SessionRepo } from "@/lib/repo/session-repo";
import { ApiError } from "@/lib/validation/api-error";
import { SessionDetailView } from "./SessionDetailView";

// SCR-006 회기 상세
export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await requireChild();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = await new SessionRepo(db).get(id).catch((e) => {
    if (e instanceof ApiError) notFound();
    throw e;
  });
  if (detail.status !== "DONE") redirect(`/sessions/${id}/processing`);

  return (
    <main className="app no-nav">
      <div className="top">
        <BackLink href="/sessions" label="회기" />
      </div>
      <SessionDetailView
        detail={{
          id: detail.id,
          sessionDate: detail.sessionDate,
          durationSec: detail.durationSec,
          summary: detail.summary,
          homework: detail.homework,
          transcript: detail.transcript,
          hasAudio: !!detail.audioPath,
        }}
      />
    </main>
  );
}
