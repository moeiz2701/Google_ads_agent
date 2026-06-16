import type { CSSProperties, ReactElement } from "react";
import { FONT_FAMILY } from "../fonts";
import { brandGradient, readableOn, withAlpha } from "../palette";
import { CtaPill } from "./primitives";
import {
  type DisplayTemplate,
  type TemplateId,
  type TemplateProps,
  TEMPLATE_IDS,
} from "./types";

/**
 * The four Display templates (§5.1). Each is a pure (content+brand+size)→JSX
 * function obeying Satori's constraints (flexbox + inline styles only). Layout is
 * fixed and human-designed; only content/colors vary. They never fetch, read
 * env, or use randomness.
 *
 * Robustness: when no stock image is resolved (`imageUrl === null`) templates
 * fall back to a deterministic brand-color backdrop, so a creative renders
 * cleanly with zero stock credentials.
 */

interface Typo {
  h1: number;
  sub: number;
  cta: number;
}

function typo(props: TemplateProps): Typo {
  const { profile } = props;
  const base = 16 * profile.fontScale;
  const cap = Math.round(profile.height * 0.5);
  return {
    h1: Math.min(Math.round(base * 2.4), cap),
    sub: Math.round(base * 1.05),
    cta: Math.round(base * 1.0),
  };
}

const FILL: CSSProperties = { position: "absolute", top: 0, left: 0 };

/** Absolutely-positioned background: cover image when present, else brand gradient. */
function Backdrop(props: TemplateProps): ReactElement {
  const { imageUrl, profile, palette } = props;
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Satori element, not DOM
      <img
        src={imageUrl}
        width={profile.width}
        height={profile.height}
        style={{ ...FILL, width: profile.width, height: profile.height, objectFit: "cover" }}
        alt=""
      />
    );
  }
  return (
    <div
      style={{
        ...FILL,
        display: "flex",
        width: profile.width,
        height: profile.height,
        backgroundImage: brandGradient(palette),
      }}
    />
  );
}

function root(profile: TemplateProps["profile"], extra: CSSProperties): CSSProperties {
  return {
    display: "flex",
    position: "relative",
    overflow: "hidden",
    width: profile.width,
    height: profile.height,
    fontFamily: FONT_FAMILY,
    ...extra,
  };
}

// ── 1. split_image_left ─────────────────────────────────────────────────────
const splitImageLeft: DisplayTemplate = (props) => {
  const { spec, profile, palette } = props;
  const t = typo(props);
  const fg = readableOn(palette.neutral);
  // Tall/narrow → stack image over copy; otherwise image-left / copy-right.
  const column = profile.cls === "skyscraper";
  const imageFlex = column ? "0 0 45%" : "0 0 42%";
  return (
    <div style={root(profile, { flexDirection: column ? "column" : "row" })}>
      <div style={{ display: "flex", flex: imageFlex, position: "relative" }}>
        <Backdrop {...props} />
      </div>
      <div
        style={{
          display: "flex",
          flex: "1 1 0%",
          flexDirection: "column",
          justifyContent: "center",
          gap: Math.round(t.sub * 0.6),
          backgroundColor: palette.neutral,
          color: fg,
          padding: profile.pad,
        }}
      >
        <div style={{ display: "flex", fontWeight: 700, fontSize: t.h1, lineHeight: 1.05 }}>
          {spec.headline}
        </div>
        {profile.showSubhead && spec.subhead ? (
          <div style={{ display: "flex", fontSize: t.sub, lineHeight: 1.15, opacity: 0.85 }}>
            {spec.subhead}
          </div>
        ) : null}
        <div style={{ display: "flex", marginTop: Math.round(t.cta * 0.4) }}>
          <CtaPill label={spec.cta} bg={palette.accent} fontSize={t.cta} />
        </div>
      </div>
    </div>
  );
};

// ── 2. image_overlay_bottom ─────────────────────────────────────────────────
const imageOverlayBottom: DisplayTemplate = (props) => {
  const { spec, profile, palette } = props;
  const t = typo(props);
  return (
    <div style={root(profile, { flexDirection: "column", justifyContent: "flex-end" })}>
      <Backdrop {...props} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: Math.round(t.sub * 0.5),
          position: "relative",
          backgroundColor: withAlpha(palette.primary, 0.82),
          color: readableOn(palette.primary),
          padding: profile.pad,
        }}
      >
        <div style={{ display: "flex", fontWeight: 700, fontSize: t.h1, lineHeight: 1.05 }}>
          {spec.headline}
        </div>
        {profile.showSubhead && spec.subhead ? (
          <div style={{ display: "flex", fontSize: t.sub, lineHeight: 1.15, opacity: 0.9 }}>
            {spec.subhead}
          </div>
        ) : null}
        <div style={{ display: "flex", marginTop: Math.round(t.cta * 0.3) }}>
          <CtaPill label={spec.cta} bg={palette.accent} fontSize={t.cta} />
        </div>
      </div>
    </div>
  );
};

// ── 3. bold_centered ────────────────────────────────────────────────────────
const boldCentered: DisplayTemplate = (props) => {
  const { spec, profile, palette } = props;
  const t = typo(props);
  const fg = readableOn(palette.primary);
  return (
    <div
      style={root(profile, {
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: Math.round(t.sub * 0.7),
        backgroundColor: palette.primary,
        color: fg,
        padding: profile.pad,
      })}
    >
      <div
        style={{
          display: "flex",
          fontWeight: 700,
          fontSize: t.h1,
          lineHeight: 1.05,
          textAlign: "center",
        }}
      >
        {spec.headline}
      </div>
      {profile.showSubhead && spec.subhead ? (
        <div style={{ display: "flex", fontSize: t.sub, lineHeight: 1.2, opacity: 0.85 }}>
          {spec.subhead}
        </div>
      ) : null}
      <div style={{ display: "flex", marginTop: Math.round(t.cta * 0.5) }}>
        <CtaPill label={spec.cta} bg={palette.accent} fontSize={t.cta} />
      </div>
    </div>
  );
};

// ── 4. minimal_left_rule ────────────────────────────────────────────────────
const minimalLeftRule: DisplayTemplate = (props) => {
  const { spec, profile, palette } = props;
  const t = typo(props);
  const fg = palette.text;
  const rule = Math.max(4, Math.round(profile.pad * 0.45));
  return (
    <div style={root(profile, { flexDirection: "row", backgroundColor: palette.neutral })}>
      <div style={{ display: "flex", width: rule, height: profile.height, backgroundColor: palette.accent }} />
      <div
        style={{
          display: "flex",
          flex: "1 1 0%",
          flexDirection: "column",
          justifyContent: "center",
          gap: Math.round(t.sub * 0.6),
          color: fg,
          padding: profile.pad,
        }}
      >
        <div style={{ display: "flex", fontWeight: 700, fontSize: t.h1, lineHeight: 1.05 }}>
          {spec.headline}
        </div>
        {profile.showSubhead && spec.subhead ? (
          <div style={{ display: "flex", fontSize: t.sub, lineHeight: 1.2, opacity: 0.8 }}>
            {spec.subhead}
          </div>
        ) : null}
        <div style={{ display: "flex", marginTop: Math.round(t.cta * 0.4) }}>
          <CtaPill label={spec.cta} bg={palette.primary} fontSize={t.cta} />
        </div>
      </div>
    </div>
  );
};

const REGISTRY: Record<TemplateId, DisplayTemplate> = {
  split_image_left: splitImageLeft,
  image_overlay_bottom: imageOverlayBottom,
  bold_centered: boldCentered,
  minimal_left_rule: minimalLeftRule,
};

/** Resolve a template by id, falling back to `bold_centered` for unknown ids
 * (generation already coerces, but the renderer must never throw on a bad id). */
export function getTemplate(id: string): DisplayTemplate {
  return REGISTRY[id as TemplateId] ?? REGISTRY.bold_centered;
}

export { TEMPLATE_IDS };
