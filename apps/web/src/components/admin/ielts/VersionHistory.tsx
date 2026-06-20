"use client";

/** Content version history (WS-1.1): immutable published snapshots + manual snapshot. */
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { snapshotIeltsTestVersionAction } from "@/app/actions/ielts";
import type { ContentVersionSummary } from "@/lib/api/ielts/versions-repository";
import { StatusBadge, type IeltsContentStatus } from "./ielts-ui";

export function VersionHistory({
  testId,
  versions,
}: {
  testId: string;
  versions: ContentVersionSummary[];
}) {
  const [busy, setBusy] = useState(false);

  async function snapshot() {
    setBusy(true);
    try {
      await snapshotIeltsTestVersionAction(testId, "Manual snapshot");
      toast.success("Snapshot saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Snapshot failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="type-body-sm text-on-surface-variant">
          {versions.length} archived version(s). Publishing snapshots automatically.
        </p>
        <Button variant="outline" size="sm" onClick={snapshot} disabled={busy}>
          {busy ? "Saving…" : "Snapshot now"}
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {versions.map((version) => (
          <div
            key={version.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span className="type-title text-on-surface">v{version.version}</span>
              <StatusBadge status={version.status as IeltsContentStatus} />
              {version.note ? (
                <span className="type-caption text-on-surface-variant">{version.note}</span>
              ) : null}
            </div>
            <span className="type-caption text-on-surface-variant">
              {new Date(version.created_at).toLocaleString()}
            </span>
          </div>
        ))}
        {versions.length === 0 ? (
          <p className="type-caption text-on-surface-variant">No versions yet.</p>
        ) : null}
      </div>
    </div>
  );
}
