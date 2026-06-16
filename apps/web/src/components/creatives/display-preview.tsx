"use client";

import { useState } from "react";
import { DISPLAY_SIZES, type DisplaySize } from "@gaa/shared";

/**
 * Live preview of a Display creative at an actual Google size. The image is
 * rendered on demand by GET /api/creatives/:id/render?size=…; switching the size
 * re-requests it. Shown scaled-to-fit but at the true aspect ratio.
 */
export function DisplayPreview({ creativeId }: { creativeId: string }) {
  const [size, setSize] = useState<DisplaySize>("1200x628");
  const [w, h] = size.split("x").map(Number) as [number, number];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor={`size-${creativeId}`} className="text-xs text-muted">
          Size
        </label>
        <select
          id={`size-${creativeId}`}
          value={size}
          onChange={(e) => setSize(e.target.value as DisplaySize)}
          className="rounded border border-border bg-bg px-2 py-1 text-xs"
        >
          {DISPLAY_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div
        className="flex items-center justify-center overflow-hidden rounded-md border border-border bg-bg"
        style={{ aspectRatio: `${w} / ${h}` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={size}
          src={`/api/creatives/${creativeId}/render?size=${size}`}
          alt={`Display creative at ${size}`}
          width={w}
          height={h}
          className="h-full w-full object-contain"
          loading="lazy"
        />
      </div>
    </div>
  );
}
