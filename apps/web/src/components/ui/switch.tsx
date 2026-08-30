import * as React from "react";

import { cn } from "@/lib/utils";

interface SwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

function Switch({
  checked,
  onCheckedChange,
  className,
  disabled,
  type = "button",
  ...props
}: SwitchProps) {
  return (
    <button
      type={type}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        if (!disabled) {
          onCheckedChange?.(!checked);
        }
      }}
      className={cn(
        "relative inline-flex h-8 w-8 min-h-8 min-w-8 shrink-0 items-center justify-center rounded-full border border-transparent bg-transparent transition-colors focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <span className={cn(
        "relative inline-flex h-[14px] w-6 items-center rounded-full transition-colors duration-150",
        checked ? "bg-secondary" : "bg-outline-variant"
      )}>
        {/* Checked/unchecked thumbs use semantic foregrounds instead of
            bg-white so the dark-mode utility remap cannot reduce contrast. */}
        <span
          className={cn(
            "absolute left-0.5 h-[10px] w-[10px] rounded-full shadow-sm transition-[background-color,transform] duration-150",
            checked ? "bg-primary-foreground" : "bg-primary",
            checked && "translate-x-[10px]"
          )}
        />
      </span>
    </button>
  );
}

export { Switch };
