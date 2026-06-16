import type { ReactElement } from "react";
import type { DisplayRenderSpec, BrandKit } from "@gaa/shared";
import type { SizeProfile } from "../sizes";
import type { Palette } from "../palette";

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
}

export type DisplayTemplate = (props: TemplateProps) => ReactElement;

/** Template IDs implemented here — MUST match services/ai templates.py. */
export const TEMPLATE_IDS = [
  "split_image_left",
  "image_overlay_bottom",
  "bold_centered",
  "minimal_left_rule",
] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export function isTemplateId(value: string): value is TemplateId {
  return (TEMPLATE_IDS as readonly string[]).includes(value);
}
