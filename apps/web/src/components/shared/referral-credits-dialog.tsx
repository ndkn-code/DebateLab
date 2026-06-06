"use client";

import Image from "next/image";
import { useState } from "react";
import { useTranslations } from "next-intl";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  BadgeCheck,
  Check,
  Copy,
  Gift,
  Share2,
  UserPlus,
} from "@/components/ui/icons";

const CREDIT_ICON_SRC = "/images/rewards/credits-coin.webp";

interface ReferralCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  referralCode: string | null;
  inviteReward: number;
}

export function ReferralCreditsDialog({
  open,
  onOpenChange,
  referralCode,
  inviteReward,
}: ReferralCreditsDialogProps) {
  const t = useTranslations("dashboard.home.referral_dialog");
  const [copied, setCopied] = useState(false);

  const referralPath = referralCode ? `/join/${referralCode}` : "";

  const getReferralLink = () => {
    if (!referralCode) return "";
    if (typeof window === "undefined") return referralPath;
    return `${window.location.origin}${referralPath}`;
  };

  const writeClipboardText = async (text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Fall back to the selection-based copy path below.
      }
    }

    if (typeof document === "undefined") return false;

    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();

    try {
      return document.execCommand("copy");
    } finally {
      document.body.removeChild(textArea);
    }
  };

  const copyReferralLink = async () => {
    if (!referralCode) return;

    await writeClipboardText(getReferralLink());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const steps = [
    {
      icon: Share2,
      title: t("step_share_title"),
      body: t("step_share_body"),
    },
    {
      icon: UserPlus,
      title: t("step_signup_title"),
      body: t("step_signup_body"),
    },
    {
      icon: BadgeCheck,
      title: t("step_reward_title", { count: inviteReward }),
      body: t("step_reward_body", { count: inviteReward }),
    },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setCopied(false);
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        data-testid="referral-credits-dialog"
        overlayClassName="bg-inverse-surface/55 backdrop-blur-sm"
        className="max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-[35rem] overflow-hidden rounded-[1.35rem] border-0 bg-surface-container-lowest p-0 shadow-2xl ring-1 ring-outline-variant/20 sm:rounded-[1.5rem]"
      >
        <div className="max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-4 sm:p-5">
          <div className="relative overflow-hidden rounded-[1.1rem] bg-[linear-gradient(135deg,var(--color-surface-container-lowest)_0%,var(--color-surface-container-low)_58%,var(--color-reward-container)_100%)] px-5 py-6 sm:px-6">
            <div className="relative z-10 max-w-[17rem] pr-6">
              <span className="inline-flex items-center gap-2 rounded-full bg-surface-container-lowest/90 px-3 py-1.5 text-sm font-bold text-on-surface shadow-token-card">
                <Gift className="h-4 w-4 text-warning" />
                {t("reward_label", { count: inviteReward })}
              </span>
              <DialogHeader className="mt-12 gap-1.5 sm:mt-14">
                <DialogTitle className="text-3xl font-black leading-tight tracking-normal text-on-surface sm:text-4xl">
                  {t("title")}
                </DialogTitle>
                <DialogDescription className="max-w-sm text-base leading-6 text-on-surface-variant">
                  {t("description", { count: inviteReward })}
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="absolute right-4 top-8 flex h-32 w-32 items-center justify-center rounded-[1.35rem] bg-primary-container/70 sm:right-6 sm:h-36 sm:w-36">
              <Image
                src={CREDIT_ICON_SRC}
                alt=""
                width={128}
                height={128}
                className="h-24 w-24 rotate-6 object-contain drop-shadow-lg sm:h-28 sm:w-28"
                loading="eager"
                unoptimized
                aria-hidden="true"
              />
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <p className="text-sm font-semibold text-on-surface">
              {t("how_it_works")}
            </p>
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-container-low text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-on-surface">
                      {step.title}
                    </p>
                    <p className="text-sm leading-5 text-on-surface-variant">
                      {step.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5">
            {referralCode ? (
              <div className="flex items-center gap-2 rounded-[1rem] bg-surface-container-low p-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-container-lowest text-primary">
                  <Copy className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1 truncate px-1 text-sm font-medium text-on-surface">
                  {getReferralLink()}
                </div>
                <Button
                  type="button"
                  data-testid="referral-copy-button"
                  aria-label={copied ? t("copied") : t("copy")}
                  onClick={copyReferralLink}
                  className="h-10 shrink-0 gap-2 rounded-xl bg-on-surface px-4 text-surface shadow-none hover:bg-on-surface/90"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      {t("copied")}
                    </>
                  ) : (
                    t("copy_short")
                  )}
                </Button>
              </div>
            ) : (
              <div className="rounded-[1rem] border border-dashed border-outline-variant/35 bg-surface-container-low px-4 py-3 text-sm leading-5 text-on-surface-variant">
                {t("pending_body")}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
