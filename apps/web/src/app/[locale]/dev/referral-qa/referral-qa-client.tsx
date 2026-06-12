"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { ReferralCreditsDialog } from "@/components/shared/referral-credits-dialog";

export function ReferralQaClient() {
  const searchParams = useSearchParams();
  const pending = searchParams.get("state") === "pending";
  const [open, setOpen] = useState(true);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-on-primary"
      >
        Open referral dialog
      </button>
      <ReferralCreditsDialog
        open={open}
        onOpenChange={setOpen}
        referralCode={pending ? null : "QA-DEBATE"}
        inviteReward={600}
      />
    </main>
  );
}
