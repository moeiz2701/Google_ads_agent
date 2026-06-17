import type { CampaignConfig, ClientProfile } from "@gaa/shared";
import type { PolicyViolation } from "./errors";

/**
 * Deterministic policy pre-check (§7.2) — the FINAL gate before publish, run on
 * the TEXT of ENABLED ads only. This is non-LLM defence-in-depth behind the
 * generation-time critique (§5.5): even if a bad string slipped through, it does
 * not reach Google's review (which frequently disapproves LLM copy, §11).
 *
 * Allowlist would be impossible for free-form ad copy, so this is a curated
 * denylist of the superlatives/claims Google Ads policy and the brand's own
 * guardrails forbid. It can only BLOCK — it never rewrites copy.
 */

/** Banned superlatives / unverifiable claims (word-boundary matched, ci). */
const BANNED_TERMS = [
  "best",
  "#1",
  "number one",
  "guaranteed",
  "guarantee",
  "cheapest",
  "lowest price",
  "risk-free",
  "risk free",
  "100%",
  "100 percent",
  "miracle",
  "cure",
  "permanent results",
  "no risk",
  "instant results",
  "perfect",
];

/** Build a word-boundary regex; escape regex metachars (e.g. "#1", "100%"). */
function termRegex(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // \b is unreliable around # and %, so anchor on non-alphanumeric or string edge.
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i");
}

const BANNED_REGEXES = BANNED_TERMS.map((t) => ({ term: t, re: termRegex(t) }));

/** Three or more consecutive ! or ? — Google flags excessive punctuation. */
const EXCESSIVE_PUNCT = /([!?])\1{2,}/;
/** A bang/question repeated across the string (e.g. "Book!! Now!!"). */
const MANY_BANGS = /(?:[!?].*){3,}/;

function scanText(
  text: string,
  location: string,
  doNotUse: string[],
): PolicyViolation[] {
  const out: PolicyViolation[] = [];
  for (const { term, re } of BANNED_REGEXES) {
    if (re.test(text)) {
      out.push({ location, text, reason: `banned superlative/claim: "${term}"` });
    }
  }
  if (EXCESSIVE_PUNCT.test(text) || MANY_BANGS.test(text)) {
    out.push({ location, text, reason: "excessive punctuation" });
  }
  const lower = text.toLowerCase();
  for (const term of doNotUse) {
    const t = term.trim().toLowerCase();
    if (t && lower.includes(t)) {
      out.push({ location, text, reason: `brand do_not_use term: "${term}"` });
    }
  }
  return out;
}

/**
 * Returns every policy violation across ENABLED ads. Empty array = clean.
 * Disabled ads are not scanned — they will not be launched.
 */
export function policyCheck(
  config: CampaignConfig,
  profile: ClientProfile,
): PolicyViolation[] {
  const doNotUse = profile.brand_kit?.do_not_use ?? [];
  const violations: PolicyViolation[] = [];

  for (const group of config.ad_groups) {
    for (const ad of group.ads) {
      if (!ad.enabled) continue;
      const where = `ad group "${group.name}"`;
      const spec = ad.spec;
      if (spec.format === "search") {
        for (const h of spec.headlines) {
          violations.push(...scanText(h.text, `${where} / search headline`, doNotUse));
        }
        for (const d of spec.descriptions) {
          violations.push(...scanText(d.text, `${where} / search description`, doNotUse));
        }
      } else {
        violations.push(...scanText(spec.headline, `${where} / display headline`, doNotUse));
        if (spec.subhead) {
          violations.push(...scanText(spec.subhead, `${where} / display subhead`, doNotUse));
        }
        violations.push(...scanText(spec.cta, `${where} / display cta`, doNotUse));
      }
    }
  }
  return violations;
}
