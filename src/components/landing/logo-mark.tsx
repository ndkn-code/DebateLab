import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoMarkProps {
  className?: string;
  imageClassName?: string;
  markOnly?: boolean;
  priority?: boolean;
  size?: "sm" | "md" | "lg" | "icon";
  variant?: "light" | "dark";
}

export function LogoMark({
  className,
  imageClassName,
  markOnly = false,
  priority = false,
  size = "md",
  variant = "light",
}: LogoMarkProps) {
  const src = markOnly
    ? "/brand/thinkfy/thinkfy-mascot-book.png"
    : variant === "dark"
      ? "/brand/thinkfy/thinkfy-logo-dark.png"
      : "/brand/thinkfy/thinkfy-logo-light.png";
  const wrapperSize = markOnly
    ? {
        icon: "h-9 w-9",
        sm: "h-10 w-10",
        md: "h-12 w-12",
        lg: "h-14 w-14",
      }[size]
    : {
        icon: "h-9 w-[102px]",
        sm: "h-10 w-[142px]",
        md: "h-12 w-[170px]",
        lg: "h-14 w-[198px]",
      }[size];

  return (
    <span className={cn("inline-flex shrink-0 items-center", wrapperSize, className)}>
      <Image
        src={src}
        alt="Thinkfy"
        width={markOnly ? 512 : 640}
        height={markOnly ? 654 : 226}
        preload={priority}
        className={cn("h-full w-full object-contain", imageClassName)}
      />
    </span>
  );
}
