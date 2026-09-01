"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MockPreTestGuide } from "./MockPreTestGuide";
import {
  IELTS_PLAYER_EXPERIENCE_COPY,
  type IeltsPlayerLocale,
} from "./player-experience";
import { useIeltsPlayerExperience } from "./player-experience-context";
import { useLocale } from "next-intl";

export function MockGuideDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const currentLocale = useLocale();
  const locale: IeltsPlayerLocale = currentLocale === "vi" ? "vi" : "en";
  const experience = useIeltsPlayerExperience();
  const copy = IELTS_PLAYER_EXPERIENCE_COPY[locale][experience];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bottom-0 left-0 top-auto !z-[1000] flex max-h-[calc(100dvh-1rem)] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-xl border border-outline-variant bg-surface p-0 shadow-2xl sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl"
        overlayClassName="!z-[900] bg-inverse-surface/20"
      >
        <DialogHeader className="border-b border-outline-variant px-4 py-4 pr-12 sm:px-5">
          <DialogTitle className="text-base font-bold text-on-surface">
            {copy.guideTitle}
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-5">
          <MockPreTestGuide
            showHeading={false}
            className="shadow-none"
            experience={experience}
            locale={locale}
          />
        </div>
        <DialogFooter className="mx-0 mb-0 rounded-none border-t border-outline-variant bg-surface px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex min-h-10 items-center justify-center rounded-control bg-primary px-5 type-label font-semibold text-on-primary transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {copy.guideClose}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
