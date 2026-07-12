"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { searchVocabulary } from "@/app/actions/vocabulary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Import, Loader2, Plus, Search, Trash2 } from "@/components/ui/icons";
import type { FlashcardContent, ActivityContent } from "@/lib/types/admin";
import type { Tables } from "@/types/supabase";

interface Props {
  content: ActivityContent;
  onChange: (content: ActivityContent) => void;
}

export function FlashcardBuilder({ content, onChange }: Props) {
  const t = useTranslations("admin.courses.builders.flashcard");
  const c = content as FlashcardContent;
  const cards = c.cards ?? [];
  const [showBank, setShowBank] = useState(false);
  const [items, setItems] = useState<Tables<"vocab_items">[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();

  const update = (cards: FlashcardContent["cards"]) =>
    onChange({ cards } as ActivityContent);

  const addCard = () =>
    update([...cards, { id: crypto.randomUUID(), front: "", back: "" }]);

  const updateCard = (
    idx: number,
    changes: Partial<FlashcardContent["cards"][0]>,
  ) => {
    const updated = [...cards];
    updated[idx] = { ...updated[idx], ...changes };
    update(updated);
  };

  const removeCard = (idx: number) => update(cards.filter((_, i) => i !== idx));

  const visibleItems = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return needle
      ? items.filter((item) => item.term.toLocaleLowerCase().includes(needle))
      : items;
  }, [items, search]);

  function openBank() {
    setShowBank(true);
    if (items.length) return;
    startTransition(async () => {
      try {
        const result = await searchVocabulary({ pageSize: 100 });
        setItems(result.items);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("bankLoadFailed"),
        );
      }
    });
  }

  function importSelected() {
    const imported = items
      .filter((item) => selected.has(item.id))
      .map((item) => ({
        id: crypto.randomUUID(),
        front: item.phonetic ? `${item.term} ${item.phonetic}` : item.term,
        back:
          item.definition_en ||
          item.definition_vi ||
          item.example ||
          item.collocations.join(", "),
      }));
    update([...cards, ...imported]);
    setSelected(new Set());
    setShowBank(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-on-surface">
          {t("cards")} ({cards.length})
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openBank}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
          >
            <Import className="h-3.5 w-3.5" />
            {t("importBank")}
          </button>
          <button
            type="button"
            onClick={addCard}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("addCard")}
          </button>
        </div>
      </div>

      {showBank ? (
        <div className="space-y-3 rounded-xl border border-outline-variant bg-surface-container-low p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-on-surface">
                {t("bankTitle")}
              </p>
              <p className="text-xs text-on-surface-variant">{t("bankHint")}</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowBank(false)}
            >
              {t("closeBank")}
            </Button>
          </div>
          <label className="relative block">
            <Search className="absolute left-3 top-2.5 size-4 text-on-surface-variant" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("searchBank")}
              className="w-full rounded-lg border border-outline-variant bg-surface py-2 pl-9 pr-3 text-sm"
            />
          </label>
          {pending ? (
            <div className="flex min-h-24 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-primary" />
            </div>
          ) : visibleItems.length ? (
            <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
              {visibleItems.map((item) => (
                <label
                  key={item.id}
                  className="flex cursor-pointer gap-2 rounded-lg border border-outline-variant bg-surface p-2"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    onChange={() =>
                      setSelected((current) => {
                        const next = new Set(current);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.add(item.id);
                        return next;
                      })
                    }
                    className="mt-1 size-4 accent-primary"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-on-surface">
                      {item.term}
                    </span>
                    <span className="line-clamp-2 text-xs text-on-surface-variant">
                      {item.definition_en || item.definition_vi}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {item.band_tag ? (
                        <Badge variant="reward">{item.band_tag}</Badge>
                      ) : null}
                      {item.topic_tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-on-surface-variant">
              {t("bankEmpty")}
            </p>
          )}
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              onClick={importSelected}
              disabled={selected.size === 0}
            >
              {t("importSelected", { count: selected.size })}
            </Button>
          </div>
        </div>
      ) : null}

      {cards.map((card, i) => (
        <div
          key={card.id}
          className="rounded-xl border border-outline-variant/20 p-3 space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-on-surface-variant">
              Card {i + 1}
            </span>
            <button
              type="button"
              onClick={() => removeCard(i)}
              disabled={cards.length <= 1}
              className="p-1 hover:bg-red-50 rounded-lg text-on-surface-variant hover:text-red-600 disabled:opacity-30"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-on-surface-variant">
                {t("front")}
              </label>
              <input
                value={card.front}
                onChange={(e) => updateCard(i, { front: e.target.value })}
                placeholder={t("frontPlaceholder")}
                className="w-full rounded-lg border border-outline-variant/20 px-3 py-1.5 text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs text-on-surface-variant">
                {t("back")}
              </label>
              <textarea
                value={card.back}
                onChange={(e) => updateCard(i, { back: e.target.value })}
                placeholder={t("backPlaceholder")}
                rows={2}
                className="w-full rounded-lg border border-outline-variant/20 px-3 py-1.5 text-sm mt-0.5 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
