"use client";

import { useState } from "react";
import { Gift, Copy, Check, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrbBalance } from "@/components/shared/orb-balance";
import { REFERRAL_REWARD_CREDITS } from "@/lib/referrals/constants";

interface ReferralStatsData {
  referralCode: string;
  totalReferred: number;
  totalCredited: number;
  totalOrbsEarned: number;
  referredUsers: { display_name: string; status: string; created_at: string }[];
}

interface ReferralStatsProps {
  stats: ReferralStatsData;
  orbBalance: number;
}

export function ReferralStats({ stats, orbBalance }: ReferralStatsProps) {
  const [copied, setCopied] = useState(false);
  const referralPath = `/join/${stats.referralCode}`;

  return (
    <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6 soft-shadow">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
          <Gift className="h-5 w-5 text-amber-500" />
        </div>
        <h2 className="text-lg font-semibold text-on-surface">Referrals & Credits</h2>
      </div>

      {/* Stats grid */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-3 text-center">
          <OrbBalance balance={orbBalance} size="md" className="justify-center" />
          <p className="mt-1 text-xs text-on-surface-variant">Balance</p>
        </div>
        <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-3 text-center">
          <p className="text-lg font-bold text-on-surface">{stats.totalCredited}</p>
          <p className="mt-0.5 text-xs text-on-surface-variant">Invited</p>
        </div>
        <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-3 text-center">
          <p className="text-lg font-bold text-amber-500">+{stats.totalOrbsEarned}</p>
          <p className="mt-0.5 text-xs text-on-surface-variant">Credits earned</p>
        </div>
      </div>

      {/* Copy link */}
      <div className="flex gap-2">
        <div className="flex-1 rounded-xl border border-outline-variant/10 bg-surface-container px-3 py-2.5 text-xs text-on-surface-variant truncate">
          {referralPath}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5 border-outline-variant/20"
          onClick={() => {
            const referralLink = `${window.location.origin}${referralPath}`;
            navigator.clipboard.writeText(referralLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {/* Referred users list */}
      {stats.referredUsers.length > 0 && (
        <div className="mt-4 border-t border-outline-variant/10 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-on-surface-variant" />
            <span className="text-sm font-medium text-on-surface">Invited friends</span>
          </div>
          <div className="space-y-2">
            {stats.referredUsers.slice(0, 5).map((u, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm bg-surface-container-low"
              >
                <span className="text-on-surface">{u.display_name}</span>
                <span
                  className={`text-xs ${
                    u.status === "credited"
                      ? "text-emerald-500"
                      : u.status === "pending"
                        ? "text-amber-500"
                        : "text-on-surface-variant"
                  }`}
                >
                  {u.status === "credited"
                    ? `+${REFERRAL_REWARD_CREDITS} Credits`
                    : u.status === "pending"
                      ? "Pending"
                      : u.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
