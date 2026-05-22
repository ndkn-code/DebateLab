"use client";

import { useState } from "react";

interface GeoPoint {
  country: string;
  city?: string;
  lat: number;
  lon: number;
  count: number;
}

interface Props {
  geoData: GeoPoint[];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function projectPoint(point: GeoPoint) {
  return {
    x: clamp(((point.lon + 180) / 360) * 100, 4, 96),
    y: clamp(((90 - point.lat) / 180) * 52, 4, 48),
  };
}

export function GlobalMap({ geoData }: Props) {
  const [tooltip, setTooltip] = useState<GeoPoint | null>(null);
  const maxCount = Math.max(...geoData.map((d) => d.count), 1);

  if (geoData.length === 0) {
    return (
      <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-on-surface mb-4">Global Users</h3>
        <div className="flex items-center justify-center h-[300px] text-on-surface-variant text-sm">
          No geo data available yet
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-5 shadow-sm relative">
      <h3 className="text-sm font-semibold text-on-surface mb-4">Global Users</h3>
      <div className="h-[350px]">
        <svg
          viewBox="0 0 100 52"
          className="h-full w-full rounded-xl bg-[#eef3f8]"
          role="img"
          aria-label="Global user distribution"
        >
          <defs>
            <pattern
              id="global-map-grid"
              width="10"
              height="8"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 10 0 L 0 0 0 8"
                fill="none"
                stroke="#d7e0ec"
                strokeWidth="0.18"
              />
            </pattern>
          </defs>
          <rect width="100" height="52" fill="url(#global-map-grid)" />
          <path
            d="M12 16c4-5 14-8 22-6 4 1 8 3 14 2 7-1 12-5 20-3 9 3 15 9 18 18 2 7-1 13-8 15-6 2-13-2-19-1-10 2-18 8-29 5C17 43 8 31 12 16Z"
            fill="#dfe8f2"
          />
          <path
            d="M18 21c5-3 12-4 17-2 4 2 8 5 13 4 6-1 9-5 15-4 6 2 12 8 12 14 0 4-3 6-8 6-6 0-10-3-15-1-8 3-14 6-23 3-9-3-17-13-11-20Z"
            fill="#d3dfeb"
          />
          {geoData.map((point, i) => {
            const position = projectPoint(point);

            return (
              <circle
                key={`${point.country}-${point.city ?? "all"}-${i}`}
                cx={position.x}
                cy={position.y}
                r={Math.max(4, (point.count / maxCount) * 16)}
                fill="#2f4fdd"
                fillOpacity={0.6}
                stroke="#2f4fdd"
                strokeWidth={1}
                strokeOpacity={0.3}
                onMouseEnter={() => setTooltip(point)}
                onMouseLeave={() => setTooltip(null)}
                className="cursor-pointer transition-all hover:fill-opacity-90"
              />
            );
          })}
        </svg>
      </div>
      {tooltip && (
        <div className="absolute top-16 right-6 bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-3 py-2 shadow-md text-sm pointer-events-none">
          <p className="font-medium text-on-surface">{tooltip.country}</p>
          {tooltip.city && <p className="text-on-surface-variant text-xs">{tooltip.city}</p>}
          <p className="text-primary font-semibold">{tooltip.count} users</p>
        </div>
      )}
    </div>
  );
}
