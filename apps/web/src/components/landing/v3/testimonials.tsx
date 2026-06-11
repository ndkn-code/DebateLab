"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { LandingV3Copy } from "./copy";
import { FlameIcon, StarIcon } from "./icons";
import { Reveal, Stagger, StaggerItem } from "./motion-primitives";
import { Eyebrow, Highlight } from "./ui";

const AVATAR_GRADIENTS = [
  "from-[#8BE8F7] to-[#00B8D9]",
  "from-[#F8D39B] to-[#E89A42]",
  "from-[#BFD8FF] to-[#89AFFF]",
  "from-[#FFC9CB] to-[#FF8A8E]",
] as const;

export function TestimonialsSection({ copy }: { copy: LandingV3Copy }) {
  return (
    <section id="stories" className="bg-surface-container px-6 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-[640px] text-center">
          <Eyebrow>{copy.testimonials.eyebrow}</Eyebrow>
          <h2 className="mt-4 text-[2.1rem] font-extrabold leading-[1.12] tracking-[-0.03em] text-on-surface sm:text-[2.9rem]">
            <Highlight text={copy.testimonials.title.text} highlight={copy.testimonials.title.highlight} />
          </h2>
        </Reveal>

        {/* Giant speech bubble framing the wall — the page's second-read moment */}
        <Reveal delay={0.15} className="relative mt-20">
          {/* Mascot sitting on the bubble's top edge */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="absolute -top-[86px] right-8 z-10 sm:-top-[98px] sm:right-16"
          >
            <Image
              src="/images/landing-v3/mascot-sitting.webp"
              alt=""
              aria-hidden="true"
              width={1254}
              height={1254}
              className="h-auto w-28 object-contain sm:w-32"
              sizes="128px"
            />
          </motion.div>

          <div className="relative rounded-[40px] border border-outline-variant bg-white p-5 shadow-token-panel sm:p-8 md:p-10">
            {/* Bubble tail */}
            <span
              aria-hidden="true"
              className="absolute -bottom-[18px] left-14 h-9 w-9 rotate-45 rounded-br-lg border-b border-r border-outline-variant bg-white sm:left-20"
            />

            <Stagger gap={0.12} className="columns-1 gap-4 md:columns-2">
              {copy.testimonials.items.map((item, index) => (
                <StaggerItem key={item.name} className="mb-4 break-inside-avoid">
                  <motion.figure
                    whileHover={{ y: -4 }}
                    transition={{ type: "spring", stiffness: 320, damping: 24 }}
                    className="rounded-[22px] border border-outline-variant/60 bg-surface-container p-6"
                  >
                    <div className="flex items-center gap-1 text-warning">
                      {Array.from({ length: 5 }).map((_, starIndex) => (
                        <StarIcon key={starIndex} className="h-3.5 w-3.5" />
                      ))}
                      {item.flame ? <FlameIcon className="ml-1.5 h-4 w-4 text-[#FF9F45]" /> : null}
                    </div>
                    <blockquote
                      className={cn(
                        "mt-4 leading-7 text-on-surface",
                        index === 0 ? "text-[1.15rem] font-bold leading-8" : "text-[1rem] font-medium"
                      )}
                    >
                      &ldquo;{item.quote}&rdquo;
                    </blockquote>
                    <figcaption className="mt-5 flex items-center gap-3">
                      <span
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-sm font-extrabold text-white",
                          AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length]
                        )}
                      >
                        {item.initials}
                      </span>
                      <span>
                        <span className="block text-[15px] font-extrabold text-on-surface">{item.name}</span>
                        <span className="block text-[13px] text-on-surface-variant">{item.role}</span>
                      </span>
                    </figcaption>
                  </motion.figure>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
