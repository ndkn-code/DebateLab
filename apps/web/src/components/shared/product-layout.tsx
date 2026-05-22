import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

export type PageContainerSize = "focused" | "standard" | "wide" | "data";

export const pageContainerSizeClassName: Record<PageContainerSize, string> = {
  focused: "max-w-3xl",
  standard: "max-w-5xl 2xl:max-w-[1504px]",
  wide: "max-w-6xl 2xl:max-w-[1680px]",
  data: "max-w-7xl 2xl:max-w-[1800px]",
};

interface PageContainerProps extends ComponentPropsWithoutRef<"div"> {
  size?: PageContainerSize;
}

export function PageContainer({
  size = "standard",
  className,
  children,
  ...props
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 py-6 sm:px-6 lg:px-8",
        pageContainerSizeClassName[size],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function ProductPageShell({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn("min-h-full bg-background text-on-surface", className)}
      {...props}
    >
      {children}
    </div>
  );
}
