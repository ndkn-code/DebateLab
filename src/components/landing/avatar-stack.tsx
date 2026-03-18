"use client";

const AVATARS = [
  { initials: "TH", color: "#4f46e5" },
  { initials: "MA", color: "#7c3aed" },
  { initials: "KL", color: "#2563eb" },
  { initials: "DP", color: "#0891b2" },
  { initials: "VN", color: "#059669" },
];

interface AvatarStackProps {
  label: string;
}

export function AvatarStack({ label }: AvatarStackProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex -space-x-2">
        {AVATARS.map((a, i) => (
          <div
            key={i}
            className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center"
            style={{ backgroundColor: a.color, zIndex: 5 - i }}
          >
            <span className="text-white text-xs font-bold">{a.initials}</span>
          </div>
        ))}
      </div>
      <span className="text-sm text-muted-foreground font-medium">{label}</span>
    </div>
  );
}
