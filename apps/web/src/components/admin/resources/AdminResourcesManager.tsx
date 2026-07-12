"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  createResourceUploadAction,
  deleteResourceAction,
  saveResourceAction,
} from "@/app/actions/resources";
import { Stagger, StaggerItem } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Select } from "@/components/ui/select";
import {
  Edit3,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  Plus,
  Trash2,
  Import,
} from "@/components/ui/icons";
import type { ResourceClubOption } from "@/lib/api/resources";
import {
  ResourceUpsertSchema,
  type ResourceAccessLevel,
  type ResourceItem,
  type ResourceKind,
  type ResourceSubject,
} from "@/lib/api/resources-model";
import { createClient } from "@/lib/supabase/client";

type EditorState = {
  id: string;
  title: string;
  description: string;
  kind: ResourceKind;
  url: string;
  storagePath: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  subject: ResourceSubject;
  tags: string;
  accessLevel: ResourceAccessLevel;
  clubId: string;
  published: boolean;
};

function emptyEditor(): EditorState {
  return {
    id: crypto.randomUUID(),
    title: "",
    description: "",
    kind: "file",
    url: "",
    storagePath: null,
    mimeType: null,
    sizeBytes: null,
    subject: "ielts",
    tags: "",
    accessLevel: "authenticated",
    clubId: "",
    published: false,
  };
}

function editorFromResource(resource: ResourceItem): EditorState {
  return {
    id: resource.id,
    title: resource.title,
    description: resource.description ?? "",
    kind: resource.kind,
    url: resource.url ?? "",
    storagePath: resource.storagePath,
    mimeType: resource.mimeType,
    sizeBytes: resource.sizeBytes,
    subject: resource.subject,
    tags: resource.tags.join(", "),
    accessLevel: resource.accessLevel,
    clubId: resource.clubId ?? "",
    published: resource.published,
  };
}

function formatBytes(value: number | null) {
  if (value == null) return null;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminResourcesManager({
  initialResources,
  clubs,
}: {
  initialResources: ResourceItem[];
  clubs: ResourceClubOption[];
}) {
  const t = useTranslations("admin.resources");
  const [resources, setResources] = useState(initialResources);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [deleting, setDeleting] = useState<ResourceItem | null>(null);
  const [pending, startTransition] = useTransition();
  const publishedCount = useMemo(() => resources.filter((resource) => resource.published).length, [resources]);

  function closeEditor() {
    if (pending) return;
    setEditor(null);
    setSelectedFile(null);
  }

  function save() {
    if (!editor) return;
    const preflight = ResourceUpsertSchema.safeParse({
      id: editor.id,
      title: editor.title,
      description: editor.description,
      kind: editor.kind,
      storagePath: editor.kind === "file" && selectedFile ? "pending/resource-file" : editor.storagePath,
      url: editor.url || null,
      mimeType: editor.mimeType,
      sizeBytes: selectedFile?.size ?? editor.sizeBytes,
      subject: editor.subject,
      tags: editor.tags.split(","),
      accessLevel: editor.accessLevel,
      clubId: editor.clubId || null,
      published: editor.published,
    });
    if (!preflight.success) {
      toast.error(preflight.error.issues[0]?.message ?? t("saveFailed"));
      return;
    }
    if (selectedFile && selectedFile.size > 50 * 1024 * 1024) {
      toast.error(t("fields.fileTooLarge"));
      return;
    }
    startTransition(async () => {
      try {
        let storagePath = editor.storagePath;
        let mimeType = editor.mimeType;
        let sizeBytes = editor.sizeBytes;
        if (editor.kind === "file" && selectedFile) {
          const target = await createResourceUploadAction({
            resourceId: editor.id,
            fileName: selectedFile.name,
            mimeType: selectedFile.type || null,
            sizeBytes: selectedFile.size,
          });
          const supabase = createClient();
          const { error } = await supabase.storage
            .from("resources")
            .uploadToSignedUrl(target.storagePath, target.token, selectedFile, {
              contentType: selectedFile.type || "application/octet-stream",
            });
          if (error) throw new Error(error.message);
          storagePath = target.storagePath;
          mimeType = target.mimeType;
          sizeBytes = target.sizeBytes;
        }

        const saved = await saveResourceAction({
          id: editor.id,
          title: editor.title,
          description: editor.description,
          kind: editor.kind,
          storagePath,
          url: editor.url || null,
          mimeType,
          sizeBytes,
          subject: editor.subject,
          tags: editor.tags.split(","),
          accessLevel: editor.accessLevel,
          clubId: editor.clubId || null,
          published: editor.published,
        });
        setResources((current) => [saved, ...current.filter((resource) => resource.id !== saved.id)]);
        setEditor(null);
        setSelectedFile(null);
        toast.success(t("saved"));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("saveFailed"));
      }
    });
  }

  function remove() {
    if (!deleting) return;
    startTransition(async () => {
      try {
        await deleteResourceAction(deleting.id);
        setResources((current) => current.filter((resource) => resource.id !== deleting.id));
        setDeleting(null);
        toast.success(t("deleted"));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("deleteFailed"));
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="type-eyebrow text-primary-dim">{t("eyebrow")}</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-on-surface">{t("title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">{t("description")}</p>
        </div>
        <Button size="lg" onClick={() => setEditor(emptyEditor())}>
          <Plus aria-hidden="true" />
          {t("create")}
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label={t("summary.total")} value={resources.length} />
        <SummaryCard label={t("summary.published")} value={publishedCount} />
        <SummaryCard label={t("summary.files")} value={resources.filter((resource) => resource.kind === "file").length} />
      </div>

      {resources.length === 0 ? (
        <Card className="border-dashed py-14 text-center">
          <CardContent className="flex flex-col items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-container text-primary-dim">
              <FileText className="size-6" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-extrabold text-on-surface">{t("empty.title")}</h2>
              <p className="mt-1 text-sm text-on-surface-variant">{t("empty.description")}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Stagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {resources.map((resource) => (
            <StaggerItem key={resource.id} className="h-full">
              <ResourceAdminCard
                resource={resource}
                onEdit={() => setEditor(editorFromResource(resource))}
                onDelete={() => setDeleting(resource)}
              />
            </StaggerItem>
          ))}
        </Stagger>
      )}

      <Dialog open={editor !== null} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
          {editor ? (
            <>
              <DialogHeader>
                <DialogTitle>{resources.some((resource) => resource.id === editor.id) ? t("editor.editTitle") : t("editor.createTitle")}</DialogTitle>
                <DialogDescription>{t("editor.description")}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field className="sm:col-span-2" label={t("fields.title")} htmlFor="resource-title">
                  <Input id="resource-title" value={editor.title} onChange={(event) => setEditor({ ...editor, title: event.target.value })} />
                </Field>
                <Field className="sm:col-span-2" label={t("fields.description")} htmlFor="resource-description">
                  <textarea
                    id="resource-description"
                    value={editor.description}
                    onChange={(event) => setEditor({ ...editor, description: event.target.value })}
                    className="min-h-24 w-full resize-y rounded-xl border border-input bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface outline-none transition-colors focus:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                  />
                </Field>
                <Field label={t("fields.kind")} htmlFor="resource-kind">
                  <Select id="resource-kind" value={editor.kind} onChange={(event) => setEditor({ ...editor, kind: event.target.value as ResourceKind })}>
                    <option value="file">{t("kind.file")}</option>
                    <option value="link">{t("kind.link")}</option>
                  </Select>
                </Field>
                <Field label={t("fields.subject")} htmlFor="resource-subject">
                  <Select id="resource-subject" value={editor.subject} onChange={(event) => setEditor({ ...editor, subject: event.target.value as ResourceSubject })}>
                    <option value="ielts">IELTS</option>
                    <option value="debate">Debate</option>
                  </Select>
                </Field>
                {editor.kind === "link" ? (
                  <Field className="sm:col-span-2" label={t("fields.url")} htmlFor="resource-url">
                    <Input id="resource-url" type="url" placeholder="https://" value={editor.url} onChange={(event) => setEditor({ ...editor, url: event.target.value })} />
                  </Field>
                ) : (
                  <Field className="sm:col-span-2" label={t("fields.file")} htmlFor="resource-file">
                    <label className="flex min-h-24 cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-4 text-center text-sm text-on-surface-variant transition-colors hover:border-primary hover:bg-primary-container">
                      <Import className="size-5 text-primary" aria-hidden="true" />
                      <span>{selectedFile?.name ?? (editor.storagePath ? t("fields.replaceFile") : t("fields.chooseFile"))}</span>
                      <input id="resource-file" type="file" className="sr-only" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} />
                    </label>
                  </Field>
                )}
                <Field className="sm:col-span-2" label={t("fields.tags")} htmlFor="resource-tags">
                  <Input id="resource-tags" value={editor.tags} placeholder={t("fields.tagsPlaceholder")} onChange={(event) => setEditor({ ...editor, tags: event.target.value })} />
                </Field>
                <Field label={t("fields.access")} htmlFor="resource-access">
                  <Select id="resource-access" value={editor.accessLevel} onChange={(event) => setEditor({ ...editor, accessLevel: event.target.value as ResourceAccessLevel })}>
                    <option value="public">{t("access.public")}</option>
                    <option value="authenticated">{t("access.authenticated")}</option>
                    <option value="club">{t("access.club")}</option>
                  </Select>
                </Field>
                {editor.accessLevel === "club" ? (
                  <Field label={t("fields.club")} htmlFor="resource-club">
                    <Select id="resource-club" value={editor.clubId} onChange={(event) => setEditor({ ...editor, clubId: event.target.value })}>
                      <option value="">{t("fields.chooseClub")}</option>
                      {clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
                    </Select>
                  </Field>
                ) : null}
                <label className="sm:col-span-2 flex items-center gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-low p-3">
                  <input type="checkbox" checked={editor.published} onChange={(event) => setEditor({ ...editor, published: event.target.checked })} className="size-4 accent-primary" />
                  <span>
                    <span className="block font-bold text-on-surface">{t("fields.published")}</span>
                    <span className="block text-xs text-on-surface-variant">{t("fields.publishedHint")}</span>
                  </span>
                </label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeEditor} disabled={pending}>{t("cancel")}</Button>
                <Button onClick={save} disabled={pending}>
                  {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                  {pending ? t("saving") : t("save")}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && !pending && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("delete.title")}</DialogTitle>
            <DialogDescription>{t("delete.description", { title: deleting?.title ?? "" })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={pending}>{t("cancel")}</Button>
            <Button variant="destructive" onClick={remove} disabled={pending}>{t("delete.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return <Card size="sm"><CardContent><p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">{label}</p><p className="mt-2 text-2xl font-extrabold text-on-surface">{value}</p></CardContent></Card>;
}

function Field({ label, htmlFor, className, children }: { label: string; htmlFor: string; className?: string; children: React.ReactNode }) {
  return <div className={className}><Label htmlFor={htmlFor} className="mb-2">{label}</Label>{children}</div>;
}

function ResourceAdminCard({ resource, onEdit, onDelete }: { resource: ResourceItem; onEdit: () => void; onDelete: () => void }) {
  const t = useTranslations("admin.resources");
  const Icon = resource.kind === "file" ? FileText : Link2;
  const destination = resource.kind === "file" ? resource.downloadUrl : resource.url;
  return (
    <Card className="h-full transition-transform duration-200 hover:-translate-y-0.5">
      <CardHeader>
        <div className="mb-3 flex items-start justify-between gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary-container text-primary-dim"><Icon className="size-5" aria-hidden="true" /></span>
          <div className="flex gap-1">
            <Button size="icon-sm" variant="ghost" aria-label={t("edit")} onClick={onEdit}><Edit3 /></Button>
            <Button size="icon-sm" variant="ghost" aria-label={t("delete.label")} onClick={onDelete}><Trash2 /></Button>
          </div>
        </div>
        <CardTitle>{resource.title}</CardTitle>
        <CardDescription className="line-clamp-2">{resource.description || t("noDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={resource.published ? "success" : "outline"}>{resource.published ? t("status.published") : t("status.draft")}</Badge>
          <Badge variant="info">{resource.subject === "ielts" ? "IELTS" : "Debate"}</Badge>
          <Badge variant="secondary">{t(`access.${resource.accessLevel}`)}</Badge>
          {resource.tags.map((tag) => <Badge key={tag} variant="outline">#{tag}</Badge>)}
        </div>
        <div className="flex items-center justify-between text-xs text-on-surface-variant">
          <span>{t(`kind.${resource.kind}`)}{formatBytes(resource.sizeBytes) ? ` · ${formatBytes(resource.sizeBytes)}` : ""}</span>
          {destination ? <a href={destination} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-primary hover:underline">{t("preview")}<ExternalLink className="size-3" /></a> : null}
        </div>
      </CardContent>
    </Card>
  );
}
