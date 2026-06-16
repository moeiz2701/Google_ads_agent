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
  /** hex colors found in inline styles / theme-color, deduped, most-frequent first. */
  colorHints: string[];
  /** visible text content, collapsed and truncated. */
  text: string;
}

const TEXT_CHAR_CAP = 12_000;

export function extractHtmlSummary(html: string, baseUrl: string): SitePageSummary {
  const title = match(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaDescription =
    metaContent(html, "description") ?? metaContent(html, "og:description");

  return {
    title: clean(title),
    metaDescription: clean(metaDescription),
    logoUrl: findLogo(html, baseUrl),
    colorHints: findColors(html),
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

function findLogo(html: string, baseUrl: string): string | null {
  const og = metaContent(html, "og:image");
  if (og) return absolutize(og, baseUrl);
  const icon = match(
    html,
    /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["']/i,
  );
  if (icon) return absolutize(icon, baseUrl);
  const imgLogo = match(html, /<img[^>]+(?:src)=["']([^"']*logo[^"']*)["']/i);
  if (imgLogo) return absolutize(imgLogo, baseUrl);
  return null;
}

function findColors(html: string): string[] {
  const counts = new Map<string, number>();
  const theme = metaContent(html, "theme-color");
  if (theme && /^#/.test(theme)) counts.set(theme.toLowerCase(), 100);
  for (const m of html.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
    const hex = m[0].toLowerCase();
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([hex]) => hex);
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
