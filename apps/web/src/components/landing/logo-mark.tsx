import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoMarkProps {
  className?: string;
  imageClassName?: string;
  markOnly?: boolean;
  priority?: boolean;
  size?: "sm" | "md" | "lg" | "icon";
  /**
   * `light` / `dark` pick a fixed wordmark. `auto` renders both and swaps on the
   * theme class, which is what the public site needs — the light wordmark has
   * dark lettering and disappears on a dark background.
   */
  variant?: "light" | "dark" | "auto";
}

const WORDMARK = {
  light: "/brand/thinkfy/thinkfy-logo-light.png",
  dark: "/brand/thinkfy/thinkfy-logo-dark.png",
} as const;

const MASCOT = "/brand/thinkfy/thinkfy-mascot-book.png";

const WRAPPER_SIZE = {
  mark: { icon: "h-9 w-9", sm: "h-10 w-10", md: "h-12 w-12", lg: "h-14 w-14" },
  wordmark: {
    icon: "h-9 w-[102px]",
    sm: "h-10 w-[142px]",
    md: "h-12 w-[170px]",
    lg: "h-14 w-[198px]",
  },
} as const;

function LogoImage({
  src,
  markOnly,
  priority,
  className,
}: {
  src: string;
  markOnly: boolean;
  priority: boolean;
  className?: string;
}) {
  return (
    <Image
      src={src}
      alt="Thinkfy"
      width={markOnly ? 512 : 640}
      height={markOnly ? 654 : 226}
      preload={priority}
      className={cn("h-full w-full object-contain", className)}
    />
  );
}

export function LogoMark({
  className,
  imageClassName,
  markOnly = false,
  priority = false,
  size = "md",
  variant = "light",
}: LogoMarkProps) {
  const wrapperClassName = cn(
    "inline-flex shrink-0 items-center",
    WRAPPER_SIZE[markOnly ? "mark" : "wordmark"][size],
    className,
  );

  if (markOnly) {
    return (
      <span className={wrapperClassName}>
        <LogoImage
          src={MASCOT}
          markOnly
          priority={priority}
          className={imageClassName}
        />
      </span>
    );
  }

  if (variant === "auto") {
    return (
      <span className={wrapperClassName}>
        <LogoImage
          src={WORDMARK.light}
          markOnly={false}
          priority={priority}
          className={cn(imageClassName, "dark:hidden")}
        />
        <LogoImage
          src={WORDMARK.dark}
          markOnly={false}
          priority={priority}
          className={cn(imageClassName, "hidden dark:block")}
        />
      </span>
    );
  }

  return (
    <span className={wrapperClassName}>
      <LogoImage
        src={WORDMARK[variant]}
        markOnly={false}
        priority={priority}
        className={imageClassName}
      />
    </span>
  );
}
