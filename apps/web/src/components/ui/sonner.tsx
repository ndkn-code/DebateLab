"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { useTheme } from "next-themes"

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme()

  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--color-popover, #fff)",
          "--normal-text": "var(--color-popover-foreground, #1a1a1a)",
          "--normal-border": "var(--color-border, #e5e7eb)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
