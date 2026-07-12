"use client";

import type { ActivityContent } from "@/lib/types/admin";
import type { IeltsTextActivityContent } from "@/lib/ielts/learn/text-activities";

export function IeltsVocabCollocationBuilder({
  content,
  onChange,
}: {
  content: ActivityContent;
  onChange: (content: ActivityContent) => void;
}) {
  const current = content as Extract<
    IeltsTextActivityContent,
    { activityType: "ielts_vocab_collocation" }
  >;
  const source = current.vocabSource;
  const setSource = (next: NonNullable<typeof source>) =>
    onChange({ ...current, vocabSource: next });
  function toggle(enabled: boolean) {
    if (enabled) setSource({ limit: 6 });
    else {
      const { vocabSource: _removed, ...legacy } = current;
      void _removed;
      onChange(legacy as ActivityContent);
    }
  }
  return (
    <div className="space-y-4 rounded-xl border border-outline-variant bg-surface p-4">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={Boolean(source)}
          onChange={(e) => toggle(e.target.checked)}
          className="mt-1 size-4 accent-primary"
        />
        <span>
          <span className="block text-sm font-semibold text-on-surface">
            Source from vocabulary bank
          </span>
          <span className="block text-xs text-on-surface-variant">
            Use reusable IELTS terms by band and topic. Turn this off to keep
            the existing question-backed source.
          </span>
        </span>
      </label>
      {source ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs font-medium text-on-surface-variant">
              Band tag
            </span>
            <input
              value={source.bandTag ?? ""}
              onChange={(e) =>
                setSource({ ...source, bandTag: e.target.value || undefined })
              }
              placeholder="6.5"
              className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-on-surface-variant">
              Topic tag
            </span>
            <input
              value={source.topicTag ?? ""}
              onChange={(e) =>
                setSource({ ...source, topicTag: e.target.value || undefined })
              }
              placeholder="education"
              className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-on-surface-variant">
              Term count
            </span>
            <input
              type="number"
              min={1}
              max={20}
              value={source.limit}
              onChange={(e) =>
                setSource({
                  ...source,
                  limit: Math.max(1, Math.min(20, Number(e.target.value) || 1)),
                })
              }
              className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
