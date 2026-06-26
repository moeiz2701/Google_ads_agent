import type { ReactElement } from "react";
import { type DisplayRenderSpec, type BrandKit, DISPLAY_TEMPLATE_IDS } from "@gaa/shared";
import type { SizeProfile } from "../sizes";
import type { Palette } from "../palette";
import type { ResolvedLogo } from "../logo";

/**
 * A Display template is a pure function: (content + brand + size) → JSX tree.
 *
 * The tree must obey Satori's constraints: flexbox layout only, inline styles
 * only, no external CSS, every text node inside an explicit element. Templates
 * NEVER fetch, NEVER read env, NEVER use randomness — given the same inputs they
 * return the same tree (the project's determinism guarantee for rendering).
 */
export interface TemplateProps {
  spec: DisplayRenderSpec;
  brandKit: BrandKit | null;
  profile: SizeProfile;
  palette: Palette;
  /** Resolved background image URL, or null → use a brand-color backdrop. */
  imageUrl: string | null;
  /** Resolved logo (data URI + intrinsic dims), pre-fetched + format-checked, or null. */
  logo: ResolvedLogo | null;
  /** Satori font family for headlines — brand heading font when loaded, else Inter. */
  headingFamily: string;
  /** Satori font family for body/subhead/CTA — brand body font when loaded, else Inter. */
  bodyFamily: string;
}

export type DisplayTemplate = (props: TemplateProps) => ReactElement;

/** Template IDs implemented here — canonical list lives in @gaa/shared. */
export const TEMPLATE_IDS = DISPLAY_TEMPLATE_IDS;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export function isTemplateId(value: string): value is TemplateId {
  return (TEMPLATE_IDS as readonly string[]).includes(value);
}
