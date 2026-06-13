"use client";

import Image from "next/image";
import { CountUp } from "../count-up";
import type { LandingV3Copy } from "./copy";
import { BoltIcon, MicIcon, TrophyIcon, UsersIcon } from "./icons";
import { Stagger, StaggerItem } from "./motion-primitives";
import { cn } from "@/lib/utils";
import { Stat, Text } from "@/components/ui/typography";

const ICONS = {
  mic: MicIcon,
  users: UsersIcon,
  bolt: BoltIcon,
  trophy: TrophyIcon,
} as const;

export function ProofSection({ copy }: { copy: LandingV3Copy }) {
  return (
    <section className="relative overflow-hidden bg-white px-6 md:px-8">
      <div className="relative mx-auto max-w-6xl border-y border-outline-variant py-14 md:py-16">
        <Stagger
          gap={0.12}
          className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4"
        >
          {copy.proof.map((item) => {
            const Icon = ICONS[item.icon];
            const isTrophy = item.icon === "trophy";
            return (
              <StaggerItem key={item.label} className="flex flex-col items-center gap-2 text-center">
                <Icon className={cn("h-7 w-7", isTrophy ? "text-reward-dim" : "text-primary")} />
                <Stat as="p" size="display-sm" className="text-on-surface">
                  {"static" in item.value ? (
                    item.value.static
                  ) : (
                    <CountUp target={item.value.target} suffix={item.value.suffix} />
                  )}
                </Stat>
                <Text variant="body-sm" className="font-medium text-on-surface-variant">{item.label}</Text>
              </StaggerItem>
            );
          })}
        </Stagger>

      </div>

      {/* Mascot peeking in from the right page edge */}
      <div className="pointer-events-none absolute -right-7 bottom-0 hidden -rotate-6 xl:block">
        <Image
          src="/brand/thinkfy/thinkfy-mascot-wave.png"
          alt=""
          aria-hidden="true"
          width={400}
          height={500}
          className="h-auto w-32 translate-y-5 object-contain"
          sizes="128px"
        />
      </div>
    </section>
  );
}
