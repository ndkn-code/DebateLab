"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MockPreTestGuide } from "./MockPreTestGuide";

export function MockGuideDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bottom-0 left-0 top-auto !z-[1000] flex max-h-[calc(100dvh-1rem)] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-xl border border-outline-variant bg-surface p-0 shadow-2xl sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl"
        overlayClassName="!z-[900] bg-inverse-surface/20"
      >
        <DialogHeader className="border-b border-outline-variant px-4 py-4 pr-12 sm:px-5">
          <DialogTitle className="text-base font-bold text-on-surface">
            How this mock works
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-5">
          <MockPreTestGuide showHeading={false} className="shadow-none" />
        </div>
        <DialogFooter className="mx-0 mb-0 rounded-none border-t border-outline-variant bg-surface px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-on-primary transition hover:bg-primary/90"
          >
            Got it
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
