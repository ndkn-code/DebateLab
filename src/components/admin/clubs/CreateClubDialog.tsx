"use client";

import { useMemo, useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { CheckCircle2, ImagePlus, Plus, Send, Trash2, UserRoundPlus, X } from "lucide-react";
import { createClub } from "@/app/actions/admin-clubs";
import { VIETNAM_CITY_OPTIONS } from "@/lib/api/admin-clubs-model";
import { cn } from "@/lib/utils";
import type { ClubRecipientInput, ClubRecipientResult, ClubRole } from "@/lib/types/admin-clubs";

const ROLE_OPTIONS: Array<{ value: ClubRole; label: string }> = [
  { value: "owner", label: "Club admin" },
  { value: "coach", label: "Coach" },
  { value: "student", label: "Member" },
];

function emptyRecipient(role: ClubRole = "student"): ClubRecipientInput {
  return { email: "", role };
}

function resultTone(status: ClubRecipientResult["status"]) {
  if (status === "invited" || status === "added" || status === "existing_member") {
    return "border-[#C8F0D5] bg-[#EAFBF0] text-[#159947]";
  }
  if (status === "email_skipped" || status === "missing_account") {
    return "border-[#FFE2A8] bg-[#FFF7E6] text-[#A96800]";
  }
  return "border-[#FFD5D5] bg-[#FFF1F1] text-[#C43D3D]";
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
        setError(caught instanceof Error ? caught.message : "Club creation failed.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-[#0B1424]/30 backdrop-blur-sm sm:items-stretch">
      <form
        onSubmit={submit}
        className="flex max-h-[94dvh] w-full flex-col rounded-t-lg border border-[#DEE8F8] bg-white shadow-2xl sm:h-full sm:max-h-none sm:max-w-[560px] sm:rounded-none sm:border-y-0 sm:border-r-0"
      >
        <div className="flex h-16 items-center justify-between border-b border-[#DEE8F8] px-5">
          <div>
            <h2 className="text-lg font-bold text-[#0B1424]">Create club</h2>
            <p className="text-xs text-[#718096]">Set up your club workspace, admins, and members.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#718096] transition hover:bg-[#F1F6FD]"
            aria-label="Close create club"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {error && (
            <div className="rounded-lg border border-[#FFD5D5] bg-[#FFF1F1] px-3 py-2 text-sm font-medium text-[#C43D3D]">
              {error}
            </div>
          )}

          {resultClubId && (
            <div className="rounded-lg border border-[#C8F0D5] bg-[#EAFBF0] p-3 text-sm text-[#126B32]">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="h-4 w-4" />
                Club created
              </div>
              <button
                type="button"
                onClick={() => onCreated(resultClubId)}
                className="mt-3 inline-flex h-9 items-center justify-center rounded-lg bg-[#4D86F7] px-3 text-sm font-bold text-white"
              >
                Open club
              </button>
            </div>
          )}

          <section className="grid gap-4 sm:grid-cols-[132px_1fr]">
            <label className="flex h-36 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed border-[#C8D7EF] bg-[#F7FAFE] text-center text-xs font-semibold text-[#718096] transition hover:border-[#4D86F7] sm:aspect-square sm:h-auto">
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview} alt="Club logo preview" className="h-full w-full object-cover" />
              ) : (
                <>
                  <ImagePlus className="mb-2 h-7 w-7 text-[#4D86F7]" />
                  <span className="font-bold text-[#1E63E9]">Upload logo</span>
                  <span className="mt-1 leading-4">PNG, JPG, SVG<br />Max 2MB</span>
                </>
              )}
              <input name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" required className="sr-only" onChange={handleLogoChange} />
            </label>

            <div className="grid gap-3">
              <label>
                <span className="text-xs font-semibold text-[#718096]">Club name <span className="text-[#FF6B6B]">*</span></span>
                <input
                  name="name"
                  required
                  placeholder="Hanoi Debate Club"
                  className="mt-1 h-11 w-full rounded-lg border border-[#DEE8F8] bg-[#F7FAFE] px-3 text-sm text-[#162033] outline-none focus:border-[#4D86F7] focus:ring-2 focus:ring-[#4D86F7]/15"
                />
              </label>
              <label>
                <span className="text-xs font-semibold text-[#718096]">City (Vietnam) <span className="text-[#FF6B6B]">*</span></span>
                <select
                  name="city"
                  required
                  defaultValue="Ha Noi"
                  className="mt-1 h-11 w-full rounded-lg border border-[#DEE8F8] bg-[#F7FAFE] px-3 text-sm text-[#162033] outline-none focus:border-[#4D86F7] focus:ring-2 focus:ring-[#4D86F7]/15"
                >
                  {VIETNAM_CITY_OPTIONS.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="grid gap-3">
            <h3 className="text-sm font-bold text-[#162033]">Social media</h3>
            <label>
              <span className="text-xs font-semibold text-[#718096]">Facebook <span className="text-[#FF6B6B]">*</span></span>
              <input
                name="facebookUrl"
                type="url"
                required
                placeholder="https://facebook.com/club"
                className="mt-1 h-11 w-full rounded-lg border border-[#DEE8F8] bg-[#F7FAFE] px-3 text-sm text-[#162033] outline-none focus:border-[#4D86F7] focus:ring-2 focus:ring-[#4D86F7]/15"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="text-xs font-semibold text-[#718096]">Instagram</span>
                <input name="instagramUrl" type="url" placeholder="https://instagram.com/club" className="mt-1 h-11 w-full rounded-lg border border-[#DEE8F8] bg-[#F7FAFE] px-3 text-sm text-[#162033] outline-none focus:border-[#4D86F7] focus:ring-2 focus:ring-[#4D86F7]/15" />
              </label>
              <label>
                <span className="text-xs font-semibold text-[#718096]">Threads</span>
                <input name="threadsUrl" type="url" placeholder="https://threads.net/@club" className="mt-1 h-11 w-full rounded-lg border border-[#DEE8F8] bg-[#F7FAFE] px-3 text-sm text-[#162033] outline-none focus:border-[#4D86F7] focus:ring-2 focus:ring-[#4D86F7]/15" />
              </label>
            </div>
          </section>

          <section className="rounded-lg border border-[#DEE8F8] bg-[#F7FAFE] p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#162033]">People</h3>
                <p className={cn("text-xs", ownerCount ? "text-[#718096]" : "text-[#C43D3D]")}>
                  At least one club admin is required.
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => addRecipient("owner")} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#DEE8F8] bg-white px-3 text-xs font-bold text-[#162033]">
                  <UserRoundPlus className="h-4 w-4 text-[#4D86F7]" />
                  Admin
                </button>
                <button type="button" onClick={() => addRecipient()} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#DEE8F8] bg-white px-3 text-xs font-bold text-[#162033]">
                  <Plus className="h-4 w-4 text-[#4D86F7]" />
                  Member
                </button>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {recipients.map((recipient, index) => (
                <div key={index} className="grid gap-2 rounded-lg border border-[#DEE8F8] bg-white p-2 sm:grid-cols-[112px_1fr_36px]">
                  <select
                    value={recipient.role}
                    onChange={(event) => updateRecipient(index, { role: event.target.value as ClubRole })}
                    className="h-10 rounded-lg border border-[#DEE8F8] bg-[#F7FAFE] px-3 text-sm outline-none focus:border-[#4D86F7]"
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                  <input
                    value={recipient.email}
                    onChange={(event) => updateRecipient(index, { email: event.target.value })}
                    type="email"
                    required={index === 0}
                    placeholder="name@example.com"
                    className="h-10 rounded-lg border border-[#DEE8F8] bg-[#F7FAFE] px-3 text-sm outline-none focus:border-[#4D86F7]"
                  />
                  <button
                    type="button"
                    onClick={() => removeRecipient(index)}
                    className="inline-flex h-10 items-center justify-center rounded-lg text-[#718096] hover:bg-[#F1F6FD]"
                    aria-label="Remove person"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <label className="flex items-center justify-between gap-3 rounded-lg border border-[#DEE8F8] bg-white p-3">
            <span>
              <span className="block text-sm font-bold text-[#162033]">Skip invitation email</span>
              <span className="block text-xs leading-5 text-[#718096]">Only existing Thinkfy accounts will be added to the club.</span>
            </span>
            <input
              type="checkbox"
              checked={skipInvitation}
              onChange={(event) => setSkipInvitation(event.target.checked)}
              className="peer sr-only"
            />
            <span className="relative h-7 w-12 shrink-0 rounded-full bg-[#D9E3F2] transition peer-checked:bg-[#2E78F6] peer-checked:[&>span]:translate-x-5">
              <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition" />
            </span>
          </label>

          {recipientResults.length > 0 && (
            <section className="space-y-2">
              {recipientResults.map((result) => (
                <div key={`${result.email}:${result.role}`} className={cn("rounded-lg border px-3 py-2 text-xs font-semibold", resultTone(result.status))}>
                  {result.email} · {result.role} · {result.status.replace(/_/g, " ")}
                </div>
              ))}
            </section>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-[#DEE8F8] p-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="inline-flex h-11 items-center justify-center rounded-lg border border-[#DEE8F8] bg-white px-4 text-sm font-bold text-[#162033]">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending || ownerCount === 0}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#4D86F7] px-4 text-sm font-bold text-white shadow-sm shadow-[#4D86F7]/20 transition disabled:cursor-not-allowed disabled:bg-[#BCC6D3]"
          >
            {skipInvitation ? <CheckCircle2 className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            {isPending ? "Creating..." : skipInvitation ? "Create and add" : "Create and invite"}
          </button>
        </div>
      </form>
    </div>
  );
}
