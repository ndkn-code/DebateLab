import { cn } from "@/lib/utils";

interface LogoMarkProps {
  className?: string;
  bubbleClassName?: string;
  textClassName?: string;
}

export function LogoMark({
  className,
  bubbleClassName,
  textClassName,
}: LogoMarkProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full bg-[#4D86F7]",
          bubbleClassName
        )}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5 text-white"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 3C6.477 3 2 6.806 2 11.5C2 14.025 3.31 16.292 5.389 17.844L4.75 21L8.342 19.088C9.487 19.362 10.715 19.5 12 19.5C17.523 19.5 22 15.694 22 11C22 6.306 17.523 3 12 3Z"
            fill="currentColor"
          />
          <circle cx="8.5" cy="11.25" r="1.1" fill="#4D86F7" />
          <circle cx="12" cy="11.25" r="1.1" fill="#4D86F7" />
          <circle cx="15.5" cy="11.25" r="1.1" fill="#4D86F7" />
        </svg>
      </div>
      <span
        className={cn(
          "text-[1.8rem] font-bold tracking-[-0.03em] text-[#0B1424]",
          textClassName
        )}
      >
        Debate Lab
      </span>
    </div>
  );
}
