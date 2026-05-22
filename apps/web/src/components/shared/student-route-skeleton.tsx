import { cn } from "@/lib/utils";

type StudentRouteSkeletonVariant =
  | "dashboard"
  | "courses"
  | "practice"
  | "feedback"
  | "chat";

interface StudentRouteSkeletonProps {
  variant?: StudentRouteSkeletonVariant;
}

const CARD_COUNTS: Record<StudentRouteSkeletonVariant, number> = {
  dashboard: 8,
  courses: 7,
  practice: 9,
  feedback: 5,
  chat: 6,
};

export function StudentRouteSkeleton({
  variant = "dashboard",
}: StudentRouteSkeletonProps) {
  const cardCount = CARD_COUNTS[variant];
  const isChat = variant === "chat";
  const isFeedback = variant === "feedback";

  if (isChat) {
    return (
      <div className="flex min-h-full animate-pulse bg-background">
        <aside className="hidden w-55 shrink-0 border-r border-outline-variant/12 bg-surface lg:block">
          <div className="border-b border-outline-variant/12 p-3">
            <div className="h-9 rounded-xl bg-surface-container-high" />
          </div>
          <div className="space-y-1 px-2 py-3">
            {Array.from({ length: 7 }).map((_, index) => (
              <div
                key={index}
                className="h-10 rounded-xl bg-surface-container-high/55"
              />
            ))}
          </div>
        </aside>
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-1 items-center justify-center px-6">
            <div className="w-full max-w-[520px] space-y-3">
              <div className="mx-auto h-20 w-20 rounded-2xl bg-surface-container-high" />
              <div className="mx-auto h-6 w-64 rounded bg-surface-container-high" />
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-11 rounded-xl border border-outline-variant/10 bg-surface-container-high/45"
                />
              ))}
            </div>
          </div>
          <div className="px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="mx-auto h-14 w-full max-w-[720px] rounded-[18px] border border-outline-variant/12 bg-surface-container-high/45" />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div
        className={cn(
          "mx-auto grid max-w-6xl animate-pulse gap-5",
          isChat
            ? "lg:grid-cols-[220px_minmax(0,1fr)]"
            : isFeedback
              ? "lg:grid-cols-[minmax(0,1fr)_320px]"
              : "grid-cols-1"
        )}
      >
        <section className="space-y-6">
          <div className="space-y-3">
            <div className="h-9 w-56 rounded-[12px] bg-surface-container-high" />
            <div className="h-4 w-full max-w-xl rounded bg-surface-container-high/60" />
          </div>

          <div
            className={cn(
              "grid gap-4",
              variant === "courses" || variant === "practice"
                ? "md:grid-cols-2 2xl:grid-cols-3"
                : "md:grid-cols-2"
            )}
          >
            {Array.from({ length: cardCount }).map((_, index) => (
              <div
                key={index}
                className={cn(
                  "rounded-[18px] border border-outline-variant/10 bg-surface-container-lowest",
                  index === 0 && !isChat ? "min-h-[220px] md:col-span-2" : "min-h-[136px]"
                )}
              >
                <div className="space-y-3 p-4">
                  <div className="h-4 w-2/3 rounded bg-surface-container-high/70" />
                  <div className="h-3 w-full rounded bg-surface-container-high/40" />
                  <div className="h-3 w-4/5 rounded bg-surface-container-high/40" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {(isChat || isFeedback) && (
          <aside className="hidden space-y-4 lg:block">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-24 rounded-[18px] border border-outline-variant/10 bg-surface-container-lowest"
              />
            ))}
          </aside>
        )}
      </div>
    </div>
  );
}
