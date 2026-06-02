"use client";

import { useState } from "react";
import { Check, X } from "@/components/ui/icons";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface TitleSelectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unlockedTitles: string[];
  currentTitle: string | null;
  onSelect: (title: string | null) => void;
}

export function TitleSelectModal({
  open,
  onOpenChange,
  unlockedTitles,
  currentTitle,
  onSelect,
}: TitleSelectModalProps) {
  const [saving, setSaving] = useState(false);

  async function handleSelect(title: string | null) {
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from("profiles")
        .update({ selected_title: title })
        .eq("id", user.id);

      onSelect(title);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose Your Title</DialogTitle>
          <DialogDescription>
            Select a title to display on your profile. Titles are earned by
            unlocking achievements.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-2">
          {/* No title option */}
          <button
            disabled={saving}
            onClick={() => handleSelect(null)}
            className={cn(
              "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-colors",
              currentTitle === null
                ? "border-[#A9C6FB] bg-[#F1F6FD] font-medium text-[#3E78EC]"
                : "border-[#DEE8F8] text-[#415069] hover:border-[#D9E5F4] hover:bg-[#F7FAFE]"
            )}
          >
            <span className="italic text-[#8A96A8]">No title</span>
            {currentTitle === null && <Check className="h-4 w-4 shrink-0" />}
          </button>

          {unlockedTitles.length === 0 ? (
            <p className="py-4 text-center text-sm text-[#8A96A8]">
              You haven&apos;t unlocked any titles yet. Keep debating!
            </p>
          ) : (
            unlockedTitles.map((title) => (
              <button
                key={title}
                disabled={saving}
                onClick={() => handleSelect(title)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                  currentTitle === title
                    ? "border-[#A9C6FB] bg-[#F1F6FD] font-medium text-[#3E78EC]"
                    : "border-[#DEE8F8] text-[#415069] hover:border-[#D9E5F4] hover:bg-[#F7FAFE]"
                )}
              >
                <span>&ldquo;{title}&rdquo;</span>
                {currentTitle === title && (
                  <Check className="h-4 w-4 shrink-0" />
                )}
              </button>
            ))
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
