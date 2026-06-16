import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Safe server-side fetch of a user-supplied URL (the client website).
 *
 * Fetching arbitrary user URLs server-side is an SSRF vector, so we:
 *  - allow only http/https
 *  - resolve the hostname and reject private / loopback / link-local IPs
 *    (blocks cloud metadata 169.254.169.254, localhost, RFC1918, etc.)
 *  - enforce a timeout and a response-size cap
 */

export class FetchSiteError extends Error {}

const MAX_BYTES = 2_000_000; // 2 MB cap
const TIMEOUT_MS = 12_000;

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    return v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true;
  const [a, b] = p as [number, number, number, number];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

export async function fetchSiteHtml(rawUrl: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new FetchSiteError(`Invalid URL: ${rawUrl}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new FetchSiteError(`Only http/https URLs are allowed`);
  }

  // Resolve and verify the destination is a public address before connecting.
  const { address } = await lookup(url.hostname).catch(() => {
    throw new FetchSiteError(`Could not resolve host: ${url.hostname}`);
  });
  if (isPrivateIp(address)) {
    throw new FetchSiteError(`Refusing to fetch a private/internal address`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": "AdsAgentBot/0.1 (+onboarding)" },
    });
    if (!res.ok) {
      throw new FetchSiteError(`Site returned HTTP ${res.status}`);
    }
    const reader = res.body?.getReader();
    if (!reader) return await res.text();

    // Stream with a hard byte cap so a huge page can't exhaust memory.
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > MAX_BYTES) {
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
    }
    return new TextDecoder("utf-8").decode(concat(chunks));
  } catch (err) {
    if (err instanceof FetchSiteError) throw err;
    throw new FetchSiteError(
      err instanceof Error && err.name === "AbortError"
        ? `Site fetch timed out after ${TIMEOUT_MS}ms`
        : `Failed to fetch site`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}
