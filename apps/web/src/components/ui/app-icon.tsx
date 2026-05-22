"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface AppIconProps {
  src: string;
  className?: string;
  size?: number;
}

export function AppIcon({
  src,
  className,
  size = 20,
}: AppIconProps) {
  return (
    <Image
      src={src}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={cn("shrink-0 select-none object-contain", className)}
      unoptimized
    />
  );
}
