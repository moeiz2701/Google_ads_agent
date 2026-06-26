/**
 * Dependency-free extraction of useful signal from raw HTML, to feed the LLM a
 * compact summary instead of a multi-MB page. Best-effort and lossy by design —
 * the LLM does the interpretation; this just trims noise.
 */

export interface SitePageSummary {
  title: string | null;
  metaDescription: string | null;
  /** absolute logo URL if discoverable (og:image / <link rel=icon> / "logo" img). */
  logoUrl: string | null;
  /** hex colors found in markup + CSS / theme-color, deduped, most-frequent first. */
  colorHints: string[];
  /** font families found in Google Fonts links / font-family rules, best-first. */
  fontHints: string[];
  /** family (lowercased) → downloadable font-file URL (ttf/otf) from @font-face. */
  fontFaces: Record<string, string>;
  /** visible text content, collapsed and truncated. */
  text: string;
}

const TEXT_CHAR_CAP = 12_000;

/**
 * Summarize a page for the LLM. `css` (optional) is the page's fetched
 * stylesheets — passing it lets color/font detection see the real design tokens
 * (which usually live in CSS, not inline markup). Text is always from the HTML.
 */
export function extractHtmlSummary(
  html: string,
  baseUrl: string,
  css = "",
): SitePageSummary {
  const title = match(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaDescription =
    metaContent(html, "description") ?? metaContent(html, "og:description");
  const styleText = css ? `${html}\n${css}` : html;

  return {
    title: clean(title),
    metaDescription: clean(metaDescription),
    logoUrl: findLogo(html, baseUrl),
    colorHints: findColors(html, css),
    fontHints: findFonts(html, css),
    fontFaces: findFontFaces(styleText, baseUrl),
    text: visibleText(html).slice(0, TEXT_CHAR_CAP),
  };
}

function match(html: string, re: RegExp): string | null {
  return re.exec(html)?.[1] ?? null;
}

function metaContent(html: string, name: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${escapeRe(name)}["'][^>]*content=["']([^"']*)["']`,
    "i",
  );
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${escapeRe(name)}["']`,
    "i",
  );
  return match(html, re) ?? match(html, alt);
}

const SOCIAL_ICON =
  /facebook|instagram|twitter|x-logo|linkedin|youtube|tiktok|pinterest|whatsapp|yelp|snapchat|threads/i;

function isRaster(url: string): boolean {
  return /\.(?:png|jpe?g|webp|gif)(?:[?#]|$)/i.test(url);
}

/**
 * Pick the most logo-like image, scored so a real logo beats a social-share
 * banner. og:image is a SHARE banner on most sites (not the logo), so it ranks
 * last; an actual <img class/alt/src "logo">, og:logo, or the apple-touch-icon
 * (a square brand mark, always raster) rank first. Social icons are excluded.
 */
function findLogo(html: string, baseUrl: string): string | null {
  const cands: Array<{ url: string; score: number }> = [];
  const push = (href: string | null | undefined, score: number) => {
    if (!href) return;
    const abs = absolutize(href, baseUrl);
    if (abs) cands.push({ url: abs, score });
  };

  // logo-named <img> (raster preferred over svg); skip social icons.
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/logo|brand/i.test(tag) || SOCIAL_ICON.test(tag)) continue;
    const src = /\bsrc=["']([^"']+)["']/i.exec(tag)?.[1];
    if (!src) continue;
    push(src, isRaster(src) ? 10 : 6);
  }

  push(metaContent(html, "og:logo"), 8);
  push(
    match(html, /<link[^>]+rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i) ??
      match(html, /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']apple-touch-icon["']/i),
    8,
  );
  push(match(html, /<link[^>]+rel=["'][^"']*\bicon\b[^"']*["'][^>]*href=["']([^"']+)["']/i), 5);
  // og:image is a social share banner — last resort only.
  push(metaContent(html, "og:image"), 1);

  if (cands.length === 0) return null;
  cands.sort((a, b) => b.score - a.score);
  return cands[0]!.url;
}

/**
 * The WordPress/Gutenberg default editor palette. These hexes ship in the markup
 * of nearly every WordPress site and are almost never the actual brand color, yet
 * they pollute frequency counts and tempt the LLM into picking a vivid green/blue.
 * We drop them from detection and strip them from the model's output.
 */
const CMS_NOISE_COLORS = new Set([
  "#cf2e2e", "#ff6900", "#fcb900", "#7bdcb5", "#00d084", "#8ed1fc",
  "#0693e3", "#9b51e0", "#f78da7", "#eb144c", "#abb8c3",
]);

export function isNoiseColor(hex: string): boolean {
  return CMS_NOISE_COLORS.has(hex.toLowerCase());
}

/** Expand #abc → #aabbcc; pass #rrggbb through; null for anything else. */
function normalizeHex(hex: string): string | null {
  const h = hex.toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(h)) return h;
  if (/^#[0-9a-f]{3}$/.test(h)) {
    return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  }
  return null;
}

function findColors(html: string, css = ""): string[] {
  const counts = new Map<string, number>();
  const theme = metaContent(html, "theme-color");
  const themeNorm = theme ? normalizeHex(theme) : null;
  if (themeNorm && !isNoiseColor(themeNorm)) counts.set(themeNorm, 100);

  // Scan both the markup and the fetched CSS — the real brand colors are usually
  // referenced repeatedly in CSS, so frequency surfaces them. 3- and 6-digit hex.
  for (const m of `${html}\n${css}`.matchAll(/#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/g)) {
    const hex = normalizeHex(m[0]);
    if (!hex || isNoiseColor(hex)) continue; // drop CMS default-palette swatches
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([hex]) => hex);
}

/** Generic CSS keywords + common system-stack tokens that aren't a brand face. */
const GENERIC_FONTS = new Set([
  "sans-serif", "serif", "monospace", "cursive", "fantasy",
  "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace", "ui-rounded",
  "-apple-system", "blinkmacsystemfont", "segoe ui", "helvetica neue",
  "helvetica", "arial", "sans", "inherit", "initial", "unset", "revert",
  "apple color emoji", "segoe ui emoji", "segoe ui symbol", "noto color emoji",
]);

/** Icon fonts that show up heavily in CSS but are never the brand typeface. */
const ICON_FONTS =
  /font\s*awesome|fontawesome|material\s*icons|material\s*symbols|dashicons|genericons|eicons|elementor\s*icons|ionicons|glyphicons|themify|simple-line-icons|feather/i;

function cleanFamily(raw: string): string | null {
  const f = raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!f || f.length > 40) return null;
  if (GENERIC_FONTS.has(f.toLowerCase()) || ICON_FONTS.test(f)) return null;
  // Reject CSS vars, numbers, and anything that isn't a plausible family name.
  if (/^(?:var\(|\$|\d|--)/.test(f) || /[<>{}=]/.test(f)) return null;
  return f;
}

/**
 * Best-effort font detection. Signals, strongest first:
 *  1. Google Fonts <link> URLs — family names right in the querystring.
 *  2. font-family declarations in inline <style> blocks.
 *  3. font-family declarations in the fetched CSS (the real brand faces).
 * Generics + icon fonts are dropped; returns up to 4 families, best-first.
 */
function findFonts(html: string, css = ""): string[] {
  const counts = new Map<string, number>();
  const add = (raw: string, weight: number) => {
    const f = cleanFamily(raw);
    if (f) counts.set(f, (counts.get(f) ?? 0) + weight);
  };

  // 1) Google Fonts links: css2?family=Poppins:wght@400;700&family=Inter ...
  //    and the legacy css?family=Poppins:400,700|Open+Sans (pipe-separated).
  for (const link of html.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'>\s]+)/gi)) {
    const qs = (link[1] ?? "").replace(/&amp;/g, "&");
    for (const fam of qs.matchAll(/family=([^&]+)/gi)) {
      for (const part of (fam[1] ?? "").split("|")) {
        const name = (part.split(":")[0] ?? "").replace(/\+/g, " ");
        try {
          add(decodeURIComponent(name), 5);
        } catch {
          add(name, 5);
        }
      }
    }
  }

  // 2) font-family in inline <style> blocks: first named family in each stack.
  for (const style of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    for (const decl of (style[1] ?? "").matchAll(/font-family\s*:\s*([^;}]+)/gi)) {
      add((decl[1] ?? "").split(",")[0] ?? "", 1);
    }
  }

  // 3) font-family in the fetched CSS (where the real brand faces are declared).
  for (const decl of css.matchAll(/font-family\s*:\s*([^;}]+)/gi)) {
    add((decl[1] ?? "").split(",")[0] ?? "", 2);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([f]) => f);
}

/**
 * Map each @font-face family → a downloadable font-file URL we can hand to
 * Satori. Only TTF/OTF are usable (Satori can't parse woff2), so we skip faces
 * that only ship woff2. Scans inline <style> and the fetched CSS.
 */
function findFontFaces(styleText: string, baseUrl: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const block of styleText.matchAll(/@font-face\s*{([^}]*)}/gi)) {
    const body = block[1] ?? "";
    const family = cleanFamily(/font-family\s*:\s*([^;]+)/i.exec(body)?.[1] ?? "");
    if (!family) continue;
    const key = family.toLowerCase();
    if (key in map) continue;
    const ttf = /url\(\s*["']?([^"')]+\.(?:ttf|otf))(?:[?#][^"')]*)?["']?\s*\)/i
      .exec(body)?.[1];
    if (!ttf) continue;
    const abs = absolutize(ttf, baseUrl);
    if (abs) map[key] = abs;
  }
  return map;
}

function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function absolutize(href: string, baseUrl: string): string | null {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function clean(s: string | null): string | null {
  if (!s) return null;
  const t = s.replace(/\s+/g, " ").trim();
  return t.length ? t : null;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
