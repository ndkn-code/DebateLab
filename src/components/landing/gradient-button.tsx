"use client";

import { Link } from "@/i18n/navigation";
import type { ReactNode } from "react";

interface GradientButtonProps {
  href: string;
  children: ReactNode;
  className?: string;
}

export function GradientButton({
  href,
  children,
  className = "",
}: GradientButtonProps) {
  return (
    <Link
      href={href}
      className={`btn-3d-primary inline-flex items-center justify-center rounded-xl bg-primary px-8 py-5 text-lg font-bold text-on-primary transition-all duration-300 hover:bg-primary-dim ${className}`}
    >
      {children}
    </Link>
  );
}
