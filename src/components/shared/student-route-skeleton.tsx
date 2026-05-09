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

  return (
    <div className="min-h-screen bg-background px-4 py-7 sm:px-6 xl:px-8">
      <div
        className={cn(
          "mx-auto grid max-w-[1440px] animate-pulse gap-6",
          isChat
            ? "lg:grid-cols-[320px_minmax(0,1fr)]"
            : isFeedback
              ? "lg:grid-cols-[minmax(0,1fr)_360px]"
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
                ? "md:grid-cols-2 xl:grid-cols-3"
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
