"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Stagger, StaggerItem } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { BookOpenText, Download, ExternalLink, FileSearch, FileText, Link2 } from "@/components/ui/icons";
import {
  collectResourceTags,
  filterResources,
  type ResourceItem,
  type ResourceSubject,
} from "@/lib/api/resources-model";
import { cn } from "@/lib/utils";

function formatBytes(value: number | null) {
  if (value == null) return null;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function ResourceLibrary({ resources }: { resources: ResourceItem[] }) {
  const t = useTranslations("resources");
  const [subject, setSubject] = useState<ResourceSubject | "all">("all");
  const [tag, setTag] = useState<string | null>(null);
  const tags = useMemo(() => collectResourceTags(resources), [resources]);
  const visible = useMemo(() => filterResources(resources, { subject, tag }), [resources, subject, tag]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="relative overflow-hidden rounded-3xl bg-primary-container p-6 ring-1 ring-primary/15 sm:p-8">
        <div className="relative z-10 max-w-2xl">
          <span className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-token-card">
            <BookOpenText className="size-6" aria-hidden="true" />
          </span>
          <p className="type-eyebrow text-primary-dim">{t("eyebrow")}</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-on-primary-container sm:text-4xl">{t("title")}</h1>
          <p className="mt-3 text-sm leading-relaxed text-on-primary-container/80 sm:text-base">{t("description")}</p>
        </div>
        <div className="pointer-events-none absolute -right-14 -top-16 size-56 rounded-full bg-primary/10 blur-3xl" />
      </header>

      <section aria-label={t("filters.label")} className="space-y-3 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4">
        <div className="grid gap-3 sm:grid-cols-[220px_1fr] sm:items-center">
          <Select aria-label={t("filters.subject")} value={subject} onChange={(event) => setSubject(event.target.value as ResourceSubject | "all")}>
            <option value="all">{t("filters.allSubjects")}</option>
            <option value="ielts">IELTS</option>
            <option value="debate">Debate</option>
          </Select>
          <p className="text-sm text-on-surface-variant">{t("count", { count: visible.length })}</p>
        </div>
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setTag(null)} className={cn("rounded-full border px-3 py-1 text-xs font-bold transition-colors", tag === null ? "border-primary bg-primary text-primary-foreground" : "border-outline-variant bg-surface text-on-surface-variant hover:border-primary")}>{t("filters.allTags")}</button>
            {tags.map((resourceTag) => (
              <button key={resourceTag} type="button" onClick={() => setTag(resourceTag)} className={cn("rounded-full border px-3 py-1 text-xs font-bold transition-colors", tag === resourceTag ? "border-primary bg-primary text-primary-foreground" : "border-outline-variant bg-surface text-on-surface-variant hover:border-primary")}>#{resourceTag}</button>
            ))}
          </div>
        ) : null}
      </section>

      {visible.length === 0 ? (
        <Card className="border-dashed py-14 text-center">
          <CardContent className="flex flex-col items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-surface-container-high text-on-surface-variant"><FileSearch className="size-6" aria-hidden="true" /></span>
            <div>
              <h2 className="font-extrabold text-on-surface">{resources.length === 0 ? t("empty.title") : t("empty.filteredTitle")}</h2>
              <p className="mt-1 text-sm text-on-surface-variant">{resources.length === 0 ? t("empty.description") : t("empty.filteredDescription")}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((resource) => (
            <StaggerItem key={resource.id} className="h-full">
              <ResourceCard resource={resource} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}

function ResourceCard({ resource }: { resource: ResourceItem }) {
  const t = useTranslations("resources");
  const Icon = resource.kind === "file" ? FileText : Link2;
  const destination = resource.kind === "file" ? resource.downloadUrl : resource.url;
  return (
    <Card className="h-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-token-card-hover">
      <CardHeader>
        <div className="mb-3 flex items-start justify-between gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary-container text-primary-dim"><Icon className="size-5" aria-hidden="true" /></span>
          <Badge variant="info">{resource.subject === "ielts" ? "IELTS" : "Debate"}</Badge>
        </div>
        <CardTitle className="text-lg font-extrabold">{resource.title}</CardTitle>
        <CardDescription className="line-clamp-3 leading-relaxed">{resource.description || t("noDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {resource.tags.map((resourceTag) => <Badge key={resourceTag} variant="outline">#{resourceTag}</Badge>)}
          <Badge variant="secondary">{t(`access.${resource.accessLevel}`)}</Badge>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-outline-variant/25 pt-4">
          <span className="text-xs text-on-surface-variant">{resource.kind === "file" ? (formatBytes(resource.sizeBytes) ?? t("kind.file")) : t("kind.link")}</span>
          {destination ? (
            <a href={destination} target="_blank" rel="noreferrer" className={buttonVariants({ size: "lg" })}>
              {resource.kind === "file" ? <Download aria-hidden="true" /> : <ExternalLink aria-hidden="true" />}
              {resource.kind === "file" ? t("open.file") : t("open.link")}
            </a>
          ) : (
            <span className={cn(buttonVariants({ size: "lg", variant: "outline" }), "cursor-not-allowed opacity-50")}>{t("open.unavailable")}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
