"use client";

import { useMemo, useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, ImagePlus, Plus, Send, Trash2, UserRoundPlus, X } from "@/components/ui/icons";
import { createClub } from "@/app/actions/admin-clubs";
import { VIETNAM_CITY_OPTIONS } from "@/lib/api/admin-clubs-model";
import { cn } from "@/lib/utils";
import type { ClubRecipientInput, ClubRecipientResult, ClubRole } from "@/lib/types/admin-clubs";
import { useAdminDialogFocus } from "@/components/admin/use-admin-dialog-focus";

const ROLE_OPTIONS: Array<{ value: ClubRole }> = [
  { value: "owner" },
  { value: "coach" },
  { value: "student" },
];

function emptyRecipient(role: ClubRole = "student"): ClubRecipientInput {
  return { email: "", role };
}

function resultTone(status: ClubRecipientResult["status"]) {
  if (status === "invited" || status === "added" || status === "existing_member") {
    return "border-outline-variant bg-surface-container text-success";
  }
  if (status === "email_skipped" || status === "missing_account") {
    return "border-outline-variant bg-surface-container text-on-surface-variant";
  }
  return "border-outline-variant bg-surface-container text-on-surface-variant";
}

export function CreateClubDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (clubId: string) => void;
}) {
  const t = useTranslations("admin.clubs");
  const [recipients, setRecipients] = useState<ClubRecipientInput[]>([emptyRecipient("owner")]);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [skipInvitation, setSkipInvitation] = useState(false);
  const [resultClubId, setResultClubId] = useState<string | null>(null);
  const [recipientResults, setRecipientResults] = useState<ClubRecipientResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const ownerCount = useMemo(
    () => recipients.filter((recipient) => recipient.role === "owner" && recipient.email.trim()).length,
    [recipients]
  );
  const dialogRef = useAdminDialogFocus<HTMLFormElement>(open, onClose);

  if (!open) return null;

  function updateRecipient(index: number, patch: Partial<ClubRecipientInput>) {
    setRecipients((current) =>
      current.map((recipient, itemIndex) => itemIndex === index ? { ...recipient, ...patch } : recipient)
    );
  }

  function addRecipient(role: ClubRole = "student") {
    setRecipients((current) => [...current, emptyRecipient(role)]);
  }

  function removeRecipient(index: number) {
    setRecipients((current) => current.length <= 1 ? current : current.filter((_, itemIndex) => itemIndex !== index));
  }

  function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setLogoPreview(file ? URL.createObjectURL(file) : null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setRecipientResults([]);
    setResultClubId(null);
    const formData = new FormData(event.currentTarget);
    formData.set("recipientsJson", JSON.stringify(recipients));
    formData.set("skipInvitation", skipInvitation ? "true" : "false");

    startTransition(async () => {
      try {
        const result = await createClub(formData);
        setResultClubId(result.clubId);
        setRecipientResults(result.recipients);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : t("create.failed"));
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-surface-container-high/30 backdrop-blur-sm sm:items-stretch" onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}>
      <form
        onSubmit={submit}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-club-dialog-title"
        className="flex max-h-[94dvh] w-full flex-col rounded-t-[10px] border border-outline-variant bg-surface shadow-lg sm:h-full sm:max-h-none sm:max-w-[560px] sm:rounded-none sm:border-y-0 sm:border-r-0"
      >
        <div className="flex h-16 items-center justify-between border-b border-outline-variant px-5">
          <div>
                <h2 id="create-club-dialog-title" className="text-lg font-bold text-on-surface">{t("create.title")}</h2>
            <p className="text-xs text-on-surface-variant">{t("create.description")}</p>
          </div>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition hover:bg-surface-container"
            aria-label={t("create.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {error && (
            <div role="alert" className="rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-sm font-medium text-on-surface-variant">
              {error}
            </div>
          )}

          {resultClubId && (
            <div role="status" aria-live="polite" className="rounded-lg border border-outline-variant bg-surface-container p-3 text-sm text-on-surface-variant">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="h-4 w-4" />
                {t("create.created")}
              </div>
              <button
                type="button"
                onClick={() => onCreated(resultClubId)}
                className="mt-3 inline-flex h-8 items-center justify-center rounded-[10px] bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:bg-primary-dim focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {t("create.open")}
              </button>
            </div>
          )}

          <section className="grid gap-4 sm:grid-cols-[132px_1fr]">
            <label className="flex h-36 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed border-outline-variant bg-background text-center text-xs font-semibold text-on-surface-variant transition hover:border-primary sm:aspect-square sm:h-auto">
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview} alt={t("create.logoPreview")} className="h-full w-full object-cover" />
              ) : (
                <>
                  <ImagePlus className="mb-2 h-7 w-7 text-primary" />
                  <span className="font-bold text-on-surface-variant">{t("create.uploadLogo")}</span>
                  <span className="mt-1 leading-4">{t("create.logoHelp")}</span>
                </>
              )}
              <input name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" required className="sr-only" onChange={handleLogoChange} />
            </label>

            <div className="grid gap-3">
              <label>
                <span className="text-xs font-semibold text-on-surface-variant">{t("create.clubName")} <span className="text-on-surface-variant">*</span></span>
                <input
                  name="name"
                  required
                  placeholder={t("create.clubNamePlaceholder")}
                  className="mt-1 h-11 w-full rounded-lg border border-outline-variant bg-background px-3 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </label>
              <label>
                <span className="text-xs font-semibold text-on-surface-variant">{t("create.city")} <span className="text-on-surface-variant">*</span></span>
                <select
                  name="city"
                  required
                  defaultValue="Ha Noi"
                  className="mt-1 h-11 w-full rounded-lg border border-outline-variant bg-background px-3 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                >
                  {VIETNAM_CITY_OPTIONS.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="grid gap-3">
            <h3 className="text-sm font-bold text-on-surface">{t("create.social")}</h3>
            <label>
              <span className="text-xs font-semibold text-on-surface-variant">{t("create.facebook")} <span className="text-on-surface-variant">*</span></span>
              <input
                name="facebookUrl"
                type="url"
                required
                placeholder={t("create.facebookPlaceholder")}
                className="mt-1 h-11 w-full rounded-lg border border-outline-variant bg-background px-3 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="text-xs font-semibold text-on-surface-variant">{t("create.instagram")}</span>
                <input name="instagramUrl" type="url" placeholder={t("create.instagramPlaceholder")} className="mt-1 h-11 w-full rounded-lg border border-outline-variant bg-background px-3 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
              </label>
              <label>
                <span className="text-xs font-semibold text-on-surface-variant">{t("create.threads")}</span>
                <input name="threadsUrl" type="url" placeholder={t("create.threadsPlaceholder")} className="mt-1 h-11 w-full rounded-lg border border-outline-variant bg-background px-3 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
              </label>
            </div>
          </section>

          <section className="rounded-lg border border-outline-variant bg-background p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-on-surface">{t("create.people")}</h3>
                <p className={cn("text-xs", ownerCount ? "text-on-surface-variant" : "text-on-surface-variant")}>
                  {t("create.adminRequired")}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => addRecipient("owner")} className="inline-flex h-8 items-center gap-2 rounded-[10px] border border-outline-variant bg-surface px-3 text-xs font-medium text-on-surface transition hover:bg-surface-container focus-visible:ring-2 focus-visible:ring-ring/50">
                  <UserRoundPlus className="h-4 w-4 text-primary" />
                  {t("roles.owner")}
                </button>
                <button type="button" onClick={() => addRecipient()} className="inline-flex h-8 items-center gap-2 rounded-[10px] border border-outline-variant bg-surface px-3 text-xs font-medium text-on-surface transition hover:bg-surface-container focus-visible:ring-2 focus-visible:ring-ring/50">
                  <Plus className="h-4 w-4 text-primary" />
                  {t("roles.student")}
                </button>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {recipients.map((recipient, index) => (
                <div key={index} className="grid gap-2 rounded-[10px] border border-outline-variant bg-surface p-2 sm:grid-cols-[112px_1fr_36px]">
                  <select
                    value={recipient.role}
                    onChange={(event) => updateRecipient(index, { role: event.target.value as ClubRole })}
                    className="h-10 rounded-lg border border-outline-variant bg-background px-3 text-sm outline-none focus:border-primary"
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role.value} value={role.value}>{t(`roles.${role.value}`)}</option>
                    ))}
                  </select>
                  <input
                    value={recipient.email}
                    onChange={(event) => updateRecipient(index, { email: event.target.value })}
                    type="email"
                    required={index === 0}
                    placeholder={t("create.emailPlaceholder")}
                    className="h-10 rounded-lg border border-outline-variant bg-background px-3 text-sm outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => removeRecipient(index)}
                    className="inline-flex h-10 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container"
                    aria-label={t("create.removePerson")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <label className="flex items-center justify-between gap-3 rounded-[10px] border border-outline-variant bg-surface p-3">
            <span>
              <span className="block text-sm font-bold text-on-surface">{t("create.skipInvitation")}</span>
              <span className="block text-xs leading-5 text-on-surface-variant">{t("create.skipInvitationHelp")}</span>
            </span>
            <input
              type="checkbox"
              checked={skipInvitation}
              onChange={(event) => setSkipInvitation(event.target.checked)}
              className="peer sr-only"
            />
            <span className="relative h-7 w-12 shrink-0 rounded-full bg-surface-container-high transition peer-checked:bg-surface-container-high peer-checked:[&>span]:translate-x-5">
              <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-surface shadow transition" />
            </span>
          </label>

          {recipientResults.length > 0 && (
            <section className="space-y-2">
              {recipientResults.map((result) => (
                <div key={`${result.email}:${result.role}`} className={cn("rounded-lg border px-3 py-2 text-xs font-semibold", resultTone(result.status))}>
                  {result.email} · {t(`roles.${result.role}`)} · {t(`result.${result.status}`)}
                </div>
              ))}
            </section>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-outline-variant p-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="inline-flex h-8 items-center justify-center rounded-[10px] border border-outline-variant bg-surface px-3 text-sm font-medium text-on-surface transition hover:bg-surface-container focus-visible:ring-2 focus-visible:ring-ring/50">
            {t("create.cancel")}
          </button>
          <button
            type="submit"
            disabled={isPending || ownerCount === 0}
            className="inline-flex h-8 items-center justify-center gap-2 rounded-[10px] bg-primary px-3 text-sm font-medium text-primary-foreground shadow-none transition hover:bg-primary-dim focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-surface-container-high"
          >
            {skipInvitation ? <CheckCircle2 className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            {isPending ? t("create.creating") : skipInvitation ? t("create.add") : t("create.invite")}
          </button>
        </div>
      </form>
    </div>
  );
}
