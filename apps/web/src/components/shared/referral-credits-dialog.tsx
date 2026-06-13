"use client";

import Image from "next/image";
import { useState } from "react";
import { useTranslations } from "next-intl";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "@/components/ui/icons";

const CREDIT_ICON_SRC = "/images/rewards/credits-coin.webp";
const SHARE_ILLUSTRATION_SRC = "/images/smart-popups/share-thinkfy.webp";

interface ReferralCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  referralCode: string | null;
  inviteReward: number;
}

function FacebookGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="currentColor" aria-hidden="true">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.5-3.91 3.78-3.91 1.09 0 2.24.2 2.24.2v2.47H15.2c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.45 2.91h-2.33V22c4.78-.76 8.43-4.92 8.43-9.94Z" />
    </svg>
  );
}

function XGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
      <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23Zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64Z" />
    </svg>
  );
}

function openSharePopup(url: string) {
  window.open(
    url,
    "thinkfy-share",
    "noopener,noreferrer,width=600,height=560,left=120,top=120"
  );
}

export function ReferralCreditsDialog({
  open,
  onOpenChange,
  referralCode,
  inviteReward,
}: ReferralCreditsDialogProps) {
  const t = useTranslations("dashboard.home.referral_dialog");
  const [copied, setCopied] = useState(false);
  const [illustrationMissing, setIllustrationMissing] = useState(false);

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

  const shareOnFacebook = () => {
    if (!referralCode) return;
    openSharePopup(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getReferralLink())}`
    );
  };

  const shareOnX = () => {
    if (!referralCode) return;
    const params = new URLSearchParams({
      text: t("share_text", { count: inviteReward }),
      url: getReferralLink(),
    });
    openSharePopup(`https://twitter.com/intent/tweet?${params.toString()}`);
  };

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
        className="max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-[26.5rem] overflow-hidden rounded-[28px] border-0 bg-surface-container-lowest p-0 shadow-2xl ring-1 ring-outline-variant/20"
      >
        <div className="max-h-[calc(100dvh-1.5rem)] overflow-y-auto px-6 pb-7 pt-9 text-center sm:px-8">
          <div className="relative mx-auto h-[150px] w-[190px]">
            {illustrationMissing ? (
              <span className="flex h-full items-center justify-center">
                <Image
                  src={CREDIT_ICON_SRC}
                  alt=""
                  width={128}
                  height={128}
                  className="size-28 object-contain drop-shadow-lg"
                  loading="eager"
                  unoptimized
                  aria-hidden="true"
                />
              </span>
            ) : (
              <Image
                src={SHARE_ILLUSTRATION_SRC}
                alt=""
                fill
                sizes="190px"
                className="object-contain"
                priority
                aria-hidden="true"
                onError={() => setIllustrationMissing(true)}
              />
            )}
          </div>

          <DialogTitle className="mt-5 text-[1.7rem] font-black leading-tight tracking-normal text-on-surface">
            {t("title")}
          </DialogTitle>

          <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-reward-container px-4 py-2">
            <Image
              src={CREDIT_ICON_SRC}
              alt=""
              width={40}
              height={40}
              className="size-6 shrink-0 object-contain"
              loading="eager"
              unoptimized
              aria-hidden="true"
            />
            <span className="text-[15px] font-extrabold tabular-nums text-[#102936]">
              {t("reward_label", { count: inviteReward })}
            </span>
          </span>

          <p className="mx-auto mt-3 max-w-[19rem] text-sm leading-6 text-on-surface-variant">
            {t("description", { count: inviteReward })}
          </p>

          <div className="mt-7">
            {referralCode ? (
              <>
                <div className="flex items-center gap-2 rounded-2xl border border-outline-variant bg-surface-container p-1.5 pl-4">
                  <div className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-on-surface">
                    {getReferralLink()}
                  </div>
                  <Button
                    type="button"
                    data-testid="referral-copy-button"
                    aria-label={copied ? t("copied") : t("copy")}
                    onClick={copyReferralLink}
                    className="h-10 shrink-0 gap-1.5 rounded-xl px-4 text-sm font-bold"
                  >
                    {copied ? (
                      <>
                        <Check className="size-4" />
                        {t("copied")}
                      </>
                    ) : (
                      <>
                        <Copy className="size-4" />
                        {t("copy_short")}
                      </>
                    )}
                  </Button>
                </div>

                <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
                  {t("share_on")}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    data-testid="referral-share-facebook"
                    onClick={shareOnFacebook}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-outline-variant bg-surface-container-lowest text-sm font-bold text-[#1877F2] transition-all hover:border-[#1877F2]/40 hover:bg-[#1877F2]/[0.06] active:scale-[0.97]"
                  >
                    <FacebookGlyph />
                    Facebook
                  </button>
                  <button
                    type="button"
                    data-testid="referral-share-x"
                    onClick={shareOnX}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-outline-variant bg-surface-container-lowest text-sm font-bold text-on-surface transition-all hover:border-on-surface/30 hover:bg-surface-container active:scale-[0.97]"
                  >
                    <XGlyph />
                    X
                  </button>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container px-4 py-3 text-sm leading-5 text-on-surface-variant">
                {t("pending_body")}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
