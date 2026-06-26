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
  fontFamily = FONT_FAMILY,
}: {
  label: string;
  bg: string;
  fontSize: number;
  fontFamily?: string;
}): ReactElement {
  return (
    <div
      style={{
        display: "flex",
        backgroundColor: bg,
        color: readableOn(bg),
        fontFamily,
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

/**
 * Optional logo, rendered on a white "chip" so a dark or single-color logo stays
 * visible on any band (the common failure: a black logo on a dark overlay). The
 * chip hugs the logo because we size the <img> from the logo's intrinsic aspect
 * (Satori needs explicit width+height — both are always set, so it can't crash).
 * Renders nothing without a logo.
 */
export function LogoSlot({
  logo,
  maxHeight,
}: {
  logo: { uri: string; width: number; height: number } | null | undefined;
  maxHeight: number;
}): ReactElement | null {
  if (!logo) return null;
  const aspect = logo.width > 0 && logo.height > 0 ? logo.width / logo.height : 3;
  const imgH = maxHeight;
  const imgW = Math.max(1, Math.round(maxHeight * Math.min(aspect, 6))); // cap ultra-wide
  const pad = Math.max(4, Math.round(maxHeight * 0.22));
  return (
    <div
      style={{
        display: "flex",
        alignSelf: "flex-start",
        backgroundColor: "#ffffff",
        padding: `${pad}px ${Math.round(pad * 1.3)}px`,
        borderRadius: Math.round(maxHeight * 0.22),
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "rgba(0,0,0,0.08)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori element, not DOM */}
      <img
        src={logo.uri}
        width={imgW}
        height={imgH}
        style={{ width: imgW, height: imgH, objectFit: "contain" }}
        alt=""
      />
    </div>
  );
}
