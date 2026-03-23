"use client";

import { useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from "react-simple-maps";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

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
        <ComposableMap
          projectionConfig={{ scale: 140, center: [0, 20] }}
          className="w-full h-full"
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#e5e7eb"
                  stroke="#fff"
                  strokeWidth={0.5}
                  style={{ default: { outline: "none" }, hover: { outline: "none", fill: "#d1d5db" }, pressed: { outline: "none" } }}
                />
              ))
            }
          </Geographies>
          {geoData.map((point, i) => (
            <Marker key={i} coordinates={[point.lon, point.lat]}>
              <circle
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
            </Marker>
          ))}
        </ComposableMap>
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
