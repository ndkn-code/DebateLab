import type { ComponentPropsWithoutRef, ReactNode } from "react";
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

export interface ProductPageHeaderProps
  extends Omit<ComponentPropsWithoutRef<"header">, "title"> {
  title: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
}

export function ProductPageHeader({
  title,
  icon,
  actions,
  className,
  ...props
}: ProductPageHeaderProps) {
  return (
    <header
      className={cn(
        "mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-3">
        {icon ? (
          <span
            aria-hidden="true"
            className="flex size-6 shrink-0 items-center justify-center text-on-surface-variant opacity-70 md:size-7 [&>svg]:size-full"
          >
            {icon}
          </span>
        ) : null}
        <h1 className="text-balance text-[24px] font-semibold leading-none tracking-normal text-on-surface sm:text-[28px] md:text-[32px]">
          {title}
        </h1>
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
