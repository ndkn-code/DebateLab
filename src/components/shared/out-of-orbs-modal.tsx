"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, Gift, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrbBalance } from "./orb-balance";

interface OutOfOrbsModalProps {
  open: boolean;
  onClose: () => void;
  referralCode: string;
  orbBalance: number;
  orbCost: number;
}

export function OutOfOrbsModal({
  open,
  onClose,
  referralCode,
  orbBalance,
  orbCost,
}: OutOfOrbsModalProps) {
  const [copied, setCopied] = useState(false);

  const referralLink = `${typeof window !== "undefined" ? window.location.origin : ""}/join/${referralCode}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join me on DebateLab!",
          text: "Practice debate with AI feedback. Use my invite link to get bonus Credits!",
          url: referralLink,
        });
      } catch {
        // User cancelled share
      }
    } else {
      handleCopy();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/30 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="mx-4 w-full max-w-sm rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6"
          >
            {/* Icon */}
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10">
                <Sparkles className="h-8 w-8 text-amber-500" />
              </div>
            </div>

            {/* Title */}
            <h3 className="text-center text-lg font-bold text-on-surface">
              Not enough Credits
            </h3>
            <p className="mt-2 text-center text-sm text-on-surface-variant">
              You need {orbCost} Credits to start this practice.
              You have <OrbBalance balance={orbBalance} size="sm" className="inline-flex align-middle mx-0.5" />.
            </p>

            {/* Referral CTA */}
            <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-on-surface">
                <Gift className="h-4 w-4 text-primary" />
                Invite a friend, get 300 Credits
              </div>
              <p className="mt-1 text-xs text-on-surface-variant">
                Both you and your friend earn 300 bonus Credits when they complete their first practice.
              </p>

              {/* Copy link */}
              <div className="mt-3 flex gap-2">
                <div className="flex-1 rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant truncate">
                  {referralLink}
                </div>
                <Button
                  onClick={handleCopy}
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5 border-outline-variant/30"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-col gap-2">
              <Button
                onClick={handleShare}
                className="w-full gap-2 bg-primary text-on-primary hover:bg-primary/90"
              >
                <Gift className="h-4 w-4" />
                Invite Friends
              </Button>
              <Button
                onClick={onClose}
                variant="ghost"
                className="w-full text-on-surface-variant"
              >
                Maybe later
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
