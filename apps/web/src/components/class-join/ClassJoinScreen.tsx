"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { claimClassJoin, previewClassJoin } from "@/app/actions/admin-classes";
import {
  classJoinPath,
  isClassJoinCode,
  normalizeClassJoinCode,
  type ClassJoinResult,
} from "@/lib/class-join/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { PageContainer } from "@/components/shared/product-layout";
import { getClassJoinCopy } from "./copy";

type Props = {
  initialCode?: string;
  signedIn: boolean;
  initialResult?: ClassJoinResult;
  previewAction?: (input: { code: string }) => Promise<ClassJoinResult>;
  claimAction?: (input: { code: string }) => Promise<ClassJoinResult>;
};

export function ClassJoinScreen({
  initialCode = "",
  signedIn,
  initialResult,
  previewAction = previewClassJoin,
  claimAction = claimClassJoin,
}: Props) {
  const locale = useLocale() === "vi" ? "vi" : "en";
  const copy = getClassJoinCopy(locale);
  const [code, setCode] = useState(() => normalizeClassJoinCode(initialCode));
  const [preview, setPreview] = useState<ClassJoinResult | undefined>(
    initialResult,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const busyRef = useRef(false);
  const requestId = useRef(0);

  const previewCode = useCallback(
    async (value: string) => {
      if (!signedIn || busyRef.current) return;
      if (!isClassJoinCode(value)) {
        setPreview({ status: "invalid" });
        return;
      }
      busyRef.current = true;
      const current = ++requestId.current;
      setBusy(true);
      setError(false);
      setPreview(undefined);
      try {
        const result = await previewAction({ code: value });
        if (current === requestId.current) setPreview(result);
      } catch {
        if (current === requestId.current) setError(true);
      } finally {
        if (current === requestId.current) {
          busyRef.current = false;
          setBusy(false);
        }
      }
    },
    [signedIn, previewAction],
  );

  useEffect(() => {
    const value = normalizeClassJoinCode(initialCode);
    requestId.current += 1;
    busyRef.current = false;
    setBusy(false);
    setCode(value);
    setPreview(initialResult);
    setError(false);
    if (!initialResult && isClassJoinCode(value)) void previewCode(value);
    return () => {
      requestId.current += 1;
      busyRef.current = false;
    };
  }, [initialCode, initialResult, previewCode]);

  function changeCode(value: string) {
    if (busyRef.current) return;
    setCode(normalizeClassJoinCode(value));
    setPreview(undefined);
    setError(false);
    requestId.current += 1;
  }

  async function join() {
    if (
      busyRef.current ||
      !signedIn ||
      preview?.status !== "ready" ||
      !isClassJoinCode(code)
    )
      return;
    busyRef.current = true;
    setBusy(true);
    setError(false);
    const current = ++requestId.current;
    try {
      const result = await claimAction({ code });
      if (current === requestId.current) setPreview({ ...preview, ...result });
    } catch {
      if (current === requestId.current) setError(true);
    } finally {
      if (current === requestId.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }

  const loginHref = `/auth/login?next=${encodeURIComponent(classJoinPath(code, locale))}`;
  const success =
    (preview?.status === "joined" || preview?.status === "already_joined") &&
    preview.classId;
  const statusText = preview && copy.status[preview.status];

  return (
    <PageContainer
      size="focused"
      className="flex min-h-[70vh] items-center py-12"
    >
      <main className="w-full space-y-6 rounded-control border border-outline-variant bg-surface-container-lowest p-6 sm:p-8">
        <div className="space-y-2">
          <h1 className="type-heading-lg text-on-surface">{copy.enterCode}</h1>
          <p className="type-body text-on-surface-variant">{copy.codeHint}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            aria-label={copy.enterCode}
            value={code}
            onChange={(event) => changeCode(event.target.value)}
            placeholder="00000000000000000000000000000000"
            inputMode="text"
            autoComplete="off"
            disabled={busy}
            className="type-code min-h-10 min-w-0"
            maxLength={128}
            onKeyDown={(event) => {
              if (event.key === "Enter" && signedIn) void previewCode(code);
            }}
          />
          <Button
            variant="outline"
            onClick={() => void previewCode(code)}
            disabled={busy || !code || !signedIn}
          >
            {busy ? copy.loading : copy.preview}
          </Button>
        </div>
        {!signedIn ? (
          <div className="space-y-3 rounded-lg border border-outline-variant bg-surface-container p-4">
            <p className="type-body text-on-surface-variant">
              {copy.signInToJoin}
            </p>
            <Button
              variant="primary"
              nativeButton={false}
              disabled={!isClassJoinCode(code)}
              render={<Link href={loginHref} />}
            >
              {copy.signIn}
            </Button>
          </div>
        ) : null}
        {error ? (
          <div className="flex flex-wrap items-center gap-3" role="alert">
            <p className="type-body-sm text-error">{copy.status.unavailable}</p>
            <Button variant="outline" onClick={() => void previewCode(code)}>
              {copy.retry}
            </Button>
          </div>
        ) : null}
        {signedIn && preview ? (
          <section
            className="space-y-4 border-t border-outline-variant pt-5"
            aria-live="polite"
          >
            {preview.classTitle ? (
              <div>
                <h2 className="break-words type-heading-md text-on-surface">
                  {preview.classTitle}
                </h2>
                {preview.organizationName ? (
                  <p className="type-body-sm text-on-surface-variant">
                    {preview.organizationName}
                  </p>
                ) : null}
              </div>
            ) : null}
            <p
              className={`type-body ${preview.status === "ready" || preview.status === "joined" || preview.status === "already_joined" ? "text-success" : "text-error"}`}
            >
              {statusText}
            </p>
            {preview.status === "sign_in_required" ? (
              <Button
                variant="primary"
                nativeButton={false}
                render={<Link href={loginHref} />}
              >
                {copy.signIn}
              </Button>
            ) : success ? (
              <Button
                variant="primary"
                nativeButton={false}
                render={
                  <Link href={`/dashboard/my-classes/${preview.classId}`} />
                }
              >
                {copy.goToClass}
              </Button>
            ) : preview.status === "ready" ? (
              <Button
                variant="primary"
                onClick={() => void join()}
                disabled={busy}
              >
                {busy ? copy.loading : copy.joinClass}
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => void previewCode(code)}
                disabled={busy}
              >
                {copy.retry}
              </Button>
            )}
          </section>
        ) : null}
        {!signedIn ? (
          <p className="type-caption text-on-surface-variant">
            {copy.classDetailsHidden}
          </p>
        ) : null}
      </main>
    </PageContainer>
  );
}
