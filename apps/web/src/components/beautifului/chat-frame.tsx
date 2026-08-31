import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Adapted from Beautiful UI's Chat primitive.
 * Original source Copyright (c) 2026 Shane Levine, MIT License.
 */
export function BeautifulChatFrame({
  sidebar,
  header,
  children,
  composer,
  className,
}: {
  sidebar?: ReactNode;
  header?: ReactNode;
  children: ReactNode;
  composer?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex h-full min-h-0 min-w-0 overflow-hidden bg-surface",
        className,
      )}
    >
      {sidebar}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {header}
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{children}</div>
        {composer}
      </div>
    </section>
  );
}
