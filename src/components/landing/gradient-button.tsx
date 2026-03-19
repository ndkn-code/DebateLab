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
      className={`inline-flex items-center justify-center bg-gradient-to-r from-[#2f4fdd] to-[#4f46e5] hover:from-[#2545c4] hover:to-[#4338ca] text-white shadow-[0_0_30px_rgba(47,79,221,0.3)] hover:shadow-[0_0_40px_rgba(47,79,221,0.45)] transition-all duration-300 text-lg px-8 py-5 rounded-xl font-bold hover:scale-105 ${className}`}
    >
      {children}
    </Link>
  );
}
