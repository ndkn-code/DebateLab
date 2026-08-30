"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  submitAgeAssuranceAction,
  type AgeAssuranceStatus,
} from "@/app/actions/age-assurance";
import type { PublicLocale } from "@/lib/public-site";

export function AgeAssuranceGate({
  locale,
  initialStatus,
}: {
  locale: PublicLocale;
  initialStatus: AgeAssuranceStatus | null;
}) {
  const vi = locale === "vi";
  const router = useRouter();
  const [ageBand, setAgeBand] = useState<"adult" | "minor" | null>(null);
  const [guardianEmail, setGuardianEmail] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!ageBand) return;
    setError(null);
    startTransition(async () => {
      const result = await submitAgeAssuranceAction({
        ageBand,
        guardianEmail,
        locale,
      });
      if (!result.ok) {
        setError(
          result.error === "invalid_guardian_email"
            ? vi
              ? "Hãy nhập email hợp lệ của phụ huynh hoặc người giám hộ."
              : "Enter a valid parent or guardian email."
            : vi
              ? "Chưa thể lưu lựa chọn. Vui lòng thử lại hoặc liên hệ hỗ trợ."
              : "We could not save this choice. Try again or contact support.",
        );
        return;
      }
      setStatus(result.status);
      setPreviewUrl(
        "previewUrl" in result ? (result.previewUrl ?? null) : null,
      );
      if (result.status === "adult_attested") router.refresh();
    });
  };

  if (status === "guardian_pending") {
    return (
      <GateShell locale={locale}>
        <h1 className="type-heading-lg font-semibold">
          {vi
            ? "Đang chờ người giám hộ xác nhận"
            : "Waiting for guardian confirmation"}
        </h1>
        <p className="mt-3 type-body text-on-surface-variant">
          {vi
            ? "Chúng tôi đã gửi liên kết xem xét có thời hạn. Sau khi người giám hộ xác nhận, hãy tải lại trang để tiếp tục."
            : "We sent a time-limited review link. Once your guardian confirms, refresh this page to continue."}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => router.refresh()}
            className="min-h-10 rounded-[10px] bg-on-surface px-4 type-label font-semibold text-surface"
          >
            {vi ? "Kiểm tra lại" : "Check again"}
          </button>
          <button
            type="button"
            onClick={() => setStatus(null)}
            className="min-h-10 rounded-[10px] border border-outline px-4 type-label font-semibold"
          >
            {vi ? "Gửi lại" : "Send again"}
          </button>
        </div>
        {previewUrl ? (
          <p className="mt-4 type-body-sm">
            <a className="text-secondary underline" href={previewUrl}>
              {vi ? "Mở liên kết kiểm thử cục bộ" : "Open local test link"}
            </a>
          </p>
        ) : null}
      </GateShell>
    );
  }

  return (
    <GateShell locale={locale}>
      <p className="type-eyebrow text-secondary">
        Thinkfy
      </p>
      <h1 className="mt-3 type-heading-lg font-semibold">
        {vi ? "Trước khi bắt đầu" : "Before you begin"}
      </h1>
      <p className="mt-3 type-body text-on-surface-variant">
        {vi
          ? "Thinkfy xử lý bài viết và giọng nói để cung cấp phản hồi. Chúng tôi chỉ cần biết nhóm tuổi, không cần ngày sinh đầy đủ."
          : "Thinkfy processes writing and voice data to provide feedback. We only need an age band, not your full date of birth."}
      </p>
      <fieldset className="mt-6 space-y-3">
        <legend className="type-title font-semibold">
          {vi ? "Bạn thuộc nhóm nào?" : "Which applies to you?"}
        </legend>
        {(["adult", "minor"] as const).map((value) => (
          <label
            key={value}
            className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[10px] border border-outline-variant p-3 hover:bg-surface-container-low"
          >
            <input
              type="radio"
              name="age-band"
              value={value}
              checked={ageBand === value}
              onChange={() => setAgeBand(value)}
            />
            <span className="type-body font-medium">
              {value === "adult"
                ? vi
                  ? "Tôi từ 18 tuổi trở lên"
                  : "I am 18 or older"
                : vi
                  ? "Tôi dưới 18 tuổi"
                  : "I am under 18"}
            </span>
          </label>
        ))}
      </fieldset>
      {ageBand === "minor" ? (
        <label className="mt-5 block type-label font-semibold">
          {vi
            ? "Email phụ huynh hoặc người giám hộ"
            : "Parent or guardian email"}
          <input
            type="email"
            autoComplete="email"
            value={guardianEmail}
            onChange={(event) => setGuardianEmail(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-[10px] border border-outline bg-surface px-3 type-body font-normal"
            required
          />
        </label>
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 type-body-sm text-error">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={
          !ageBand || pending || (ageBand === "minor" && !guardianEmail)
        }
        onClick={submit}
        className="mt-6 min-h-11 w-full rounded-[10px] bg-on-surface px-4 type-label font-semibold text-surface disabled:cursor-not-allowed disabled:opacity-45"
      >
        {pending
          ? vi
            ? "Đang lưu…"
            : "Saving…"
          : ageBand === "minor"
            ? vi
              ? "Gửi yêu cầu đồng ý"
              : "Send consent request"
            : vi
              ? "Tiếp tục"
              : "Continue"}
      </button>
      <p className="mt-4 type-body-sm text-on-surface-variant">
        {vi ? "Xem " : "Read our "}
        <Link className="text-secondary underline" href={`/${locale}/privacy`}>
          {vi ? "Chính sách quyền riêng tư" : "Privacy Policy"}
        </Link>
        .
      </p>
    </GateShell>
  );
}

function GateShell({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: PublicLocale;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 text-on-surface">
      <section
        aria-label={locale === "vi" ? "Xác nhận độ tuổi" : "Age assurance"}
        className="w-full max-w-lg rounded-xl border border-outline-variant bg-surface p-6 shadow-sm sm:p-8"
      >
        {children}
      </section>
    </main>
  );
}
