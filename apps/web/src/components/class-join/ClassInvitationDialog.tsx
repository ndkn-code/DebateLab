"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { manageClassJoinInvitation } from "@/app/actions/admin-classes";
import {
  classJoinPath,
  type ClassInvitation,
  type ClassInvitationAction,
  type ClassInvitationResult,
  type ClassJoinStatus,
} from "@/lib/class-join/contracts";
import { Button } from "@/components/ui/button";
import {
  Copy,
  Link2,
  Loader2,
  RefreshCw,
  UserRoundPlus,
  X,
} from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getClassJoinCopy } from "./copy";

type Props = {
  classId: string;
  classTitle: string;
  manageAction?: (input: {
    classId: string;
    action: ClassInvitationAction;
    expectedId?: string;
  }) => Promise<ClassInvitationResult>;
};
type ConfirmAction = "replace" | "revoke" | null;

function formatExpiry(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ClassInvitationDialog({
  classId,
  classTitle,
  manageAction = manageClassJoinInvitation,
}: Props) {
  const locale = useLocale() === "vi" ? "vi" : "en";
  const copy = getClassJoinCopy(locale);
  const [open, setOpen] = useState(false);
  const [invitation, setInvitation] = useState<ClassInvitation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [errorStatus, setErrorStatus] = useState<ClassJoinStatus | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const requestRef = useRef(0);
  const busyRef = useRef(false);

  useEffect(() => {
    requestRef.current += 1;
    busyRef.current = false;
    setBusy(false);
    setOpen(false);
    setInvitation(null);
    setError(false);
    setErrorStatus(null);
    setFeedback(null);
    setConfirmAction(null);
  }, [classId]);

  async function run(
    action: "get" | "create" | "replace" | "revoke",
    expectedId?: string,
  ) {
    if (busyRef.current) return;
    busyRef.current = true;
    const request = ++requestRef.current;
    setBusy(true);
    setError(false);
    setErrorStatus(null);
    setFeedback(null);
    try {
      const result = await manageAction({ classId, action, expectedId });
      if (request !== requestRef.current) return;
      if (result.invitation !== undefined)
        setInvitation(result.invitation ?? null);
      if (result.status && result.status !== "ready") {
        setError(true);
        setErrorStatus(result.status);
      }
    } catch {
      if (request === requestRef.current) setError(true);
    } finally {
      if (request === requestRef.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }

  function handleOpen(next: boolean) {
    setOpen(next);
    if (next) void run("get");
    else {
      requestRef.current += 1;
      busyRef.current = false;
      setBusy(false);
      setConfirmAction(null);
      setFeedback(null);
    }
  }

  async function copyValue(value: string, label: string) {
    const request = requestRef.current;
    try {
      await navigator.clipboard.writeText(value);
      if (request === requestRef.current)
        setFeedback(`${label} · ${copy.copied}`);
    } catch {
      if (request === requestRef.current) setFeedback(copy.copyFailed);
    }
  }

  const link =
    invitation && typeof window !== "undefined"
      ? `${window.location.origin}${classJoinPath(invitation.code, locale)}`
      : (invitation?.code ?? "");
  const actionLabel =
    confirmAction === "replace" ? copy.replaceCode : copy.revokeCode;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <UserRoundPlus />
        {copy.inviteStudents}
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100vh-2rem)] overflow-y-auto rounded-control sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle className="type-heading-md text-on-surface">
            {copy.invitationFor(classTitle)}
          </DialogTitle>
          <DialogDescription className="type-body-sm text-on-surface-variant">
            {copy.policy}
          </DialogDescription>
        </DialogHeader>
        {busy ? (
          <div className="flex items-center gap-2 py-8 type-body-sm text-on-surface-variant">
            <Loader2 className="animate-spin" />
            {copy.loading}
          </div>
        ) : error ? (
          <div className="space-y-3 py-4">
            <p className="type-body-sm text-error">
              {errorStatus ? copy.status[errorStatus] : copy.unavailable}
            </p>
            <Button variant="outline" onClick={() => void run("get")}>
              <RefreshCw />
              {copy.retry}
            </Button>
          </div>
        ) : invitation ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="class-invitation-link"
                className="type-label text-on-surface"
              >
                {copy.copyLink}
              </label>
              <div className="flex gap-2">
                <Input
                  id="class-invitation-link"
                  value={link}
                  readOnly
                  onFocus={(event) => event.currentTarget.select()}
                  className="type-body-sm min-w-0 rounded-control"
                />
                <Button
                  variant={confirmAction ? "outline" : "primary"}
                  onClick={() => void copyValue(link, copy.copyLink)}
                >
                  <Link2 />
                  {copy.copyLink}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <label
                htmlFor="class-invitation-code"
                className="type-label text-on-surface"
              >
                {copy.copyCode}
              </label>
              <div className="flex gap-2">
                <Input
                  id="class-invitation-code"
                  value={invitation.code}
                  readOnly
                  onFocus={(event) => event.currentTarget.select()}
                  className="type-code min-w-0 rounded-control"
                />
                <Button
                  variant="outline"
                  onClick={() => void copyValue(invitation.code, copy.copyCode)}
                >
                  <Copy />
                  {copy.copyCode}
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 type-body-sm text-on-surface-variant">
              <span>
                {copy.expires(formatExpiry(invitation.expiresAt, locale))}
              </span>
              <span>{copy.uses(invitation.useCount, invitation.maxUses)}</span>
            </div>
            {new Date(invitation.expiresAt).getTime() <= Date.now() ||
            invitation.useCount >= invitation.maxUses ? (
              <p className="type-body-sm text-error">
                {new Date(invitation.expiresAt).getTime() <= Date.now()
                  ? copy.status.expired
                  : copy.status.exhausted}
              </p>
            ) : null}
            {feedback ? (
              <p role="status" className="type-body-sm text-primary">
                {feedback}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 border-t border-outline-variant pt-4">
              <Button
                variant="outline"
                onClick={() => setConfirmAction("replace")}
              >
                <RefreshCw />
                {copy.replaceCode}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setConfirmAction("revoke")}
              >
                <X />
                {copy.revokeCode}
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-4">
            <Button variant="primary" onClick={() => void run("create")}>
              <UserRoundPlus />
              {copy.createCode}
            </Button>
          </div>
        )}
        {confirmAction ? (
          <div
            role="group"
            aria-label={actionLabel}
            className="space-y-3 rounded-control border border-warning bg-warning-container p-3"
          >
            <p className="type-title text-on-warning-container">
              {confirmAction === "replace"
                ? copy.replaceQuestion
                : copy.revokeQuestion}
            </p>
            <p className="type-body-sm text-on-warning-container">
              {confirmAction === "replace"
                ? copy.replaceDescription
                : copy.revokeDescription}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmAction(null)}>
                {copy.cancel}
              </Button>
              <Button
                variant={confirmAction === "revoke" ? "destructive" : "primary"}
                onClick={() => {
                  const action = confirmAction;
                  setConfirmAction(null);
                  void run(action, invitation?.id);
                }}
              >
                {copy.confirm}
              </Button>
            </div>
          </div>
        ) : null}
        <DialogFooter className="rounded-b-control border-outline-variant bg-surface-container-low">
          <Button variant="outline" onClick={() => handleOpen(false)}>
            {copy.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
