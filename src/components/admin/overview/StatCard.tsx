"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface Props {
  title: string;
  value: number;
  growth?: number;
  icon: React.ReactNode;
}

export function StatCard({ title, value, growth, icon }: Props) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    if (value === 0) return;
    const duration = 600;
    const steps = 30;
    const increment = value / steps;
    let current = 0;
    const interval = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayed(value);
        clearInterval(interval);
      } else {
        setDisplayed(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(interval);
  }, [value]);

  return (
    <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-on-surface-variant">{title}</span>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold text-on-surface">
        {displayed.toLocaleString()}
      </p>
      {growth !== undefined && (
        <div className={`flex items-center gap-1 mt-1 text-sm font-medium ${growth >= 0 ? "text-green-600" : "text-red-500"}`}>
          {growth >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          <span>{growth >= 0 ? "+" : ""}{growth}%</span>
        </div>
      )}
    </div>
  );
}
