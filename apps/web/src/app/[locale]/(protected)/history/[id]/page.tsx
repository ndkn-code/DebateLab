import SessionDetailClient from "./session-detail-client";
import { loadOwnedSessionResult } from "@/lib/results/session-result-server";

export const dynamic = "force-dynamic";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await loadOwnedSessionResult(id);

  if (result.status === "loaded") {
    return (
      <SessionDetailClient
        sessionId={id}
        initialSession={result.session}
        initialState="loaded"
      />
    );
  }

  return (
    <SessionDetailClient
      sessionId={id}
      initialSession={null}
      initialState={result.status}
      initialLoadError={result.status === "error" ? result.message : null}
    />
  );
}
