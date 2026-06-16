import type { ReactElement } from "react";
import { FONT_FAMILY } from "../fonts";
import { readableOn } from "../palette";

/**
 * Shared visual primitives for the four templates. Extracted because all four
 * render a CTA pill and a logo slot identically — keeping them here guarantees
 * the CTA looks the same across templates and sizes.
 */

/** A solid CTA pill. `bg` is the brand color; text auto-contrasts for legibility. */
export function CtaPill({
  label,
  bg,
  fontSize,
}: {
  label: string;
  bg: string;
  fontSize: number;
}): ReactElement {
  return (
    <div
      style={{
        display: "flex",
        backgroundColor: bg,
        color: readableOn(bg),
        fontFamily: FONT_FAMILY,
        fontWeight: 700,
        fontSize,
        lineHeight: 1,
        padding: `${Math.round(fontSize * 0.7)}px ${Math.round(fontSize * 1.2)}px`,
        borderRadius: Math.round(fontSize * 0.6),
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  );
}

/** Optional logo image; renders nothing when no logo URL is present. */
export function LogoSlot({
  url,
  maxHeight,
}: {
  url: string | null | undefined;
  maxHeight: number;
}): ReactElement | null {
  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Satori element, not DOM
    <img
      src={url}
      height={maxHeight}
      style={{ height: maxHeight, objectFit: "contain" }}
      alt=""
    />
  );
}
