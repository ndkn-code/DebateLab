"use client";

const AVATARS = [
  { initials: "TH", color: "#4f46e5" },
  { initials: "MA", color: "#2563eb" },
  { initials: "KL", color: "#3b82f6" },
  { initials: "DP", color: "#0891b2" },
  { initials: "VN", color: "#059669" },
];

interface AvatarStackProps {
  label: string;
  variant?: "default" | "on-dark";
}

export function AvatarStack({ label, variant = "default" }: AvatarStackProps) {
  const isDark = variant === "on-dark";

  return (
    <div className="flex items-center gap-3">
      <div className="flex -space-x-2">
        {AVATARS.map((a, i) => (
          <div
            key={i}
            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
              isDark ? "border-white/30" : "border-white"
            }`}
            style={{ backgroundColor: a.color, zIndex: 5 - i }}
          >
            <span className="text-white text-xs font-bold">{a.initials}</span>
          </div>
        ))}
      </div>
      <span
        className={`text-sm font-medium ${
          isDark ? "text-white/90" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
