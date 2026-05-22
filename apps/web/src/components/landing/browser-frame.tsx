"use client";

import Image from "next/image";

interface BrowserFrameProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
}

export function BrowserFrame({
  src,
  alt,
  width = 1200,
  height = 800,
  className = "",
}: BrowserFrameProps) {
  return (
    <div
      className={`relative bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden ${className}`}
    >
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="px-3 py-0.5 bg-gray-100 rounded-md text-xs text-gray-400">
            debate-lab.vercel.app
          </div>
        </div>
      </div>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        unoptimized
        priority
        sizes="(max-width: 768px) 100vw, 600px"
        className="w-full"
      />
    </div>
  );
}
