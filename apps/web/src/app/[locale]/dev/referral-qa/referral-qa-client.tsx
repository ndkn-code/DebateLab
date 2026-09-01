"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { ReferralCreditsDialog } from "@/components/shared/referral-credits-dialog";
import { DevQaFrame } from "../dev-v2";

export function ReferralQaClient() {
  const searchParams = useSearchParams();
  const pending = searchParams.get("state") === "pending";
  const [open, setOpen] = useState(true);

  return (
    <DevQaFrame
      title="Referral credits dialog"
      description="Preview the invite flow in both the ready and pending states."
    >
      <div className="flex min-h-[280px] items-center justify-center rounded-control border border-dashed border-border bg-surface-container-low p-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-8 items-center rounded-control bg-primary px-3 type-label font-semibold text-on-primary transition-colors duration-150 hover:bg-primary-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:translate-y-px"
        >
          Open referral dialog
        </button>
      </div>
      <ReferralCreditsDialog
        open={open}
        onOpenChange={setOpen}
        referralCode={pending ? null : "QA-DEBATE"}
        inviteReward={600}
      />
    </DevQaFrame>
  );
}
