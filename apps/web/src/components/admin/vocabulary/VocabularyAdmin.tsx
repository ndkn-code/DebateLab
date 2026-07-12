"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { removeVocabulary, saveVocabulary } from "@/app/actions/vocabulary";
import { StatCard } from "@/components/data-viz";
import { Stagger, StaggerItem } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BookOpenText,
  Bookmark,
  Edit3,
  Languages,
  Plus,
  Search,
  Trash2,
} from "@/components/ui/icons";
import type { VocabItem, VocabPage } from "@/lib/api/vocab";
import { parseStringList } from "@/lib/vocab/model";

type Draft = {
  id?: string;
  term: string;
  partOfSpeech: string;
  phonetic: string;
  definitionEn: string;
  definitionVi: string;
  example: string;
  synonyms: string;
  collocations: string;
  topicTags: string;
  bandTag: string;
  subject: "ielts" | "debate";
  source: string;
};
const EMPTY: Draft = {
  term: "",
  partOfSpeech: "",
  phonetic: "",
  definitionEn: "",
  definitionVi: "",
  example: "",
  synonyms: "",
  collocations: "",
  topicTags: "",
  bandTag: "",
  subject: "ielts",
  source: "",
};

function toDraft(item: VocabItem): Draft {
  return {
    id: item.id,
    term: item.term,
    partOfSpeech: item.part_of_speech ?? "",
    phonetic: item.phonetic ?? "",
    definitionEn: item.definition_en ?? "",
    definitionVi: item.definition_vi ?? "",
    example: item.example ?? "",
    synonyms: item.synonyms.join(", "),
    collocations: item.collocations.join(", "),
    topicTags: item.topic_tags.join(", "),
    bandTag: item.band_tag ?? "",
    subject: item.subject as Draft["subject"],
    source: item.source ?? "",
  };
}

function Area({
  id,
  label,
  value,
  onChange,
  rows = 3,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-y rounded-xl border border-input bg-surface px-3 py-2 text-sm text-on-surface outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/20"
      />
    </div>
  );
}

export function VocabularyAdmin({ data }: { data: VocabPage }) {
  const t = useTranslations("admin.vocabulary");
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, startTransition] = useTransition();
  const change = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));

  function save() {
    if (!draft) return;
    startTransition(async () => {
      try {
        await saveVocabulary({
          ...draft,
          synonyms: parseStringList(draft.synonyms),
          collocations: parseStringList(draft.collocations),
          topicTags: parseStringList(draft.topicTags),
          partOfSpeech: draft.partOfSpeech || null,
          phonetic: draft.phonetic || null,
          definitionEn: draft.definitionEn || null,
          definitionVi: draft.definitionVi || null,
          example: draft.example || null,
          bandTag: draft.bandTag || null,
          source: draft.source || null,
        });
        toast.success(t("saved"));
        setDraft(null);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("saveFailed"));
      }
    });
  }

  function remove(item: VocabItem) {
    if (!window.confirm(t("deleteConfirm", { term: item.term }))) return;
    startTransition(async () => {
      try {
        await removeVocabulary(item.id);
        toast.success(t("deleted"));
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("deleteFailed"));
      }
    });
  }

  const pageIelts = data.items.filter(
    (item) => item.subject === "ielts",
  ).length;
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="type-label font-semibold text-primary">
            {t("eyebrow")}
          </p>
          <h1 className="type-display-sm text-on-surface">{t("title")}</h1>
          <p className="type-body-sm max-w-2xl text-on-surface-variant">
            {t("description")}
          </p>
        </div>
        <Button onClick={() => setDraft({ ...EMPTY })}>
          <Plus />
          {t("create")}
        </Button>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label={t("counts.total")}
          value={data.totalCount}
          icon={<BookOpenText className="size-5" />}
        />
        <StatCard
          label={t("counts.ieltsPage")}
          value={pageIelts}
          icon={<Languages className="size-5" />}
        />
        <StatCard
          label={t("counts.debatePage")}
          value={data.items.length - pageIelts}
          icon={<Bookmark className="size-5" />}
        />
      </div>
      <Card>
        <CardContent className="pt-6">
          <form
            method="get"
            className="grid gap-3 md:grid-cols-[1fr_10rem_9rem_11rem_auto]"
          >
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 size-4 text-on-surface-variant" />
              <Input
                name="search"
                defaultValue={data.filters.search}
                placeholder={t("filters.search")}
                className="pl-9"
              />
            </label>
            <select
              name="subject"
              defaultValue={data.filters.subject}
              className="min-h-10 rounded-xl border border-input bg-surface px-3 text-sm"
            >
              <option value="all">{t("filters.allSubjects")}</option>
              <option value="ielts">IELTS</option>
              <option value="debate">{t("subjects.debate")}</option>
            </select>
            <select
              name="bandTag"
              defaultValue={data.filters.bandTag}
              className="min-h-10 rounded-xl border border-input bg-surface px-3 text-sm"
            >
              <option value="">{t("filters.allBands")}</option>
              {data.bands.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <select
              name="topicTag"
              defaultValue={data.filters.topicTag}
              className="min-h-10 rounded-xl border border-input bg-surface px-3 text-sm"
            >
              <option value="">{t("filters.allTopics")}</option>
              {data.topics.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <Button type="submit" variant="outline">
              {t("filters.apply")}
            </Button>
          </form>
        </CardContent>
      </Card>
      {data.items.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
            <BookOpenText className="size-10 text-on-surface-variant" />
            <div>
              <h2 className="type-title text-on-surface">{t("empty.title")}</h2>
              <p className="type-body-sm text-on-surface-variant">
                {t("empty.description")}
              </p>
            </div>
            <Button variant="outline" onClick={() => setDraft({ ...EMPTY })}>
              <Plus />
              {t("create")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Stagger className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.items.map((item) => (
            <StaggerItem key={item.id}>
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>{item.term}</CardTitle>
                      <p className="mt-1 type-caption text-on-surface-variant">
                        {item.phonetic}{" "}
                        {item.part_of_speech ? `· ${item.part_of_speech}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={t("edit")}
                        onClick={() => setDraft(toDraft(item))}
                      >
                        <Edit3 />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={t("delete")}
                        disabled={pending}
                        onClick={() => remove(item)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="type-body-sm text-on-surface">
                    {item.definition_en ||
                      item.definition_vi ||
                      t("noDefinition")}
                  </p>
                  {item.definition_vi ? (
                    <p className="type-caption text-on-surface-variant">
                      {item.definition_vi}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="primary">
                      {item.subject === "ielts"
                        ? "IELTS"
                        : t("subjects.debate")}
                    </Badge>
                    {item.band_tag ? (
                      <Badge variant="reward">Band {item.band_tag}</Badge>
                    ) : null}
                    {item.topic_tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  {item.collocations.length ? (
                    <p className="type-caption text-on-surface-variant">
                      <b>{t("fields.collocations")}:</b>{" "}
                      {item.collocations.join(" · ")}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      )}
      <div className="flex items-center justify-between type-caption text-on-surface-variant">
        <span>
          {t("pagination", { page: data.page, pages: data.pageCount })}
        </span>
        <div className="flex gap-2">
          <Button
            render={<a href={pageHref(data, data.page - 1)} />}
            nativeButton={false}
            variant="outline"
            size="sm"
            disabled={data.page <= 1}
          >
            {t("previous")}
          </Button>
          <Button
            render={<a href={pageHref(data, data.page + 1)} />}
            nativeButton={false}
            variant="outline"
            size="sm"
            disabled={data.page >= data.pageCount}
          >
            {t("next")}
          </Button>
        </div>
      </div>
      <Dialog
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open) setDraft(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {draft?.id ? t("form.editTitle") : t("form.createTitle")}
            </DialogTitle>
            <DialogDescription>{t("form.description")}</DialogDescription>
          </DialogHeader>
          {draft ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="v-term">{t("fields.term")}</Label>
                <Input
                  id="v-term"
                  value={draft.term}
                  onChange={(e) => change("term", e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>{t("fields.subject")}</Label>
                <select
                  value={draft.subject}
                  onChange={(e) =>
                    change("subject", e.target.value as Draft["subject"])
                  }
                  className="min-h-10 w-full rounded-xl border border-input bg-surface px-3 text-sm"
                >
                  <option value="ielts">IELTS</option>
                  <option value="debate">{t("subjects.debate")}</option>
                </select>
              </div>
              <Field
                id="v-band"
                label={t("fields.band")}
                value={draft.bandTag}
                onChange={(v) => change("bandTag", v)}
                placeholder="6.5"
              />
              <Field
                id="v-pos"
                label={t("fields.partOfSpeech")}
                value={draft.partOfSpeech}
                onChange={(v) => change("partOfSpeech", v)}
              />
              <Field
                id="v-ipa"
                label={t("fields.phonetic")}
                value={draft.phonetic}
                onChange={(v) => change("phonetic", v)}
                placeholder="/ˈsæl.i.ənt/"
              />
              <Area
                id="v-en"
                label={t("fields.definitionEn")}
                value={draft.definitionEn}
                onChange={(v) => change("definitionEn", v)}
              />
              <Area
                id="v-vi"
                label={t("fields.definitionVi")}
                value={draft.definitionVi}
                onChange={(v) => change("definitionVi", v)}
              />
              <div className="sm:col-span-2">
                <Area
                  id="v-example"
                  label={t("fields.example")}
                  value={draft.example}
                  onChange={(v) => change("example", v)}
                />
              </div>
              <Area
                id="v-syn"
                label={t("fields.synonyms")}
                value={draft.synonyms}
                onChange={(v) => change("synonyms", v)}
                rows={2}
              />
              <Area
                id="v-col"
                label={t("fields.collocations")}
                value={draft.collocations}
                onChange={(v) => change("collocations", v)}
                rows={2}
              />
              <Area
                id="v-topic"
                label={t("fields.topicTags")}
                value={draft.topicTags}
                onChange={(v) => change("topicTags", v)}
                rows={2}
              />
              <Area
                id="v-source"
                label={t("fields.source")}
                value={draft.source}
                onChange={(v) => change("source", v)}
                rows={2}
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              {t("cancel")}
            </Button>
            <Button onClick={save} disabled={pending || !draft?.term.trim()}>
              {pending ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function pageHref(data: VocabPage, page: number) {
  const params = new URLSearchParams({
    subject: data.filters.subject,
    bandTag: data.filters.bandTag,
    topicTag: data.filters.topicTag,
    search: data.filters.search,
    page: String(Math.max(1, page)),
  });
  return `?${params}`;
}
