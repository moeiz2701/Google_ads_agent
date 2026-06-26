import "server-only";
import { assertPublicUrl } from "./fetch-site";

/**
 * Best-effort fetch of a page's SAME-ORIGIN stylesheets, concatenated and capped.
 *
 * The real design tokens (brand colors, font-family, @font-face) live in CSS, not
 * inline markup — so feeding the analyzer the stylesheets sharply improves
 * color/font detection. Same-origin only + the shared SSRF guard, bounded file
 * count / bytes / time. Never throws: returns "" on any problem, so onboarding
 * degrades to the HTML-only signal.
 */

const MAX_FILES = 4;
const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 8_000;

function stylesheetHrefs(html: string, baseUrl: string): string[] {
  const origin = new URL(baseUrl).origin;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/rel=["'][^"']*stylesheet[^"']*["']/i.test(tag)) continue;
    const href = /\bhref=["']([^"']+)["']/i.exec(tag)?.[1];
    if (!href) continue;
    let abs: URL;
    try {
      abs = new URL(href, baseUrl);
    } catch {
      continue;
    }
    if (abs.origin !== origin) continue; // same-origin only (avoid 3rd-party CDNs)
    const key = abs.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
    if (out.length >= MAX_FILES) break;
  }
  return out;
}

export async function fetchStylesheets(html: string, baseUrl: string): Promise<string> {
  let hrefs: string[];
  try {
    hrefs = stylesheetHrefs(html, baseUrl);
  } catch {
    return "";
  }

  const parts: string[] = [];
  let total = 0;
  for (const href of hrefs) {
    if (total >= MAX_BYTES) break;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const url = new URL(href);
      await assertPublicUrl(url);
      const res = await fetch(url.toString(), {
        signal: controller.signal,
        redirect: "follow",
        headers: { "user-agent": "AdsAgentBot/0.1 (+onboarding)" },
      });
      if (!res.ok) continue;
      const ct = (res.headers.get("content-type") ?? "").toLowerCase();
      if (ct && !ct.includes("css") && !ct.includes("text")) continue;
      const text = await res.text();
      const slice = text.slice(0, Math.max(0, MAX_BYTES - total));
      parts.push(slice);
      total += slice.length;
    } catch {
      // skip this stylesheet — best-effort
    } finally {
      clearTimeout(timer);
    }
  }
  return parts.join("\n");
}
