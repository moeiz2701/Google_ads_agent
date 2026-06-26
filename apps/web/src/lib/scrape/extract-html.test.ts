import { describe, it, expect } from "vitest";
import { extractHtmlSummary } from "./extract-html";

/**
 * Regression fixture mirroring the real signals on a WordPress site
 * (viomedspa.com): an og:image SHARE banner, an apple-touch-icon brand mark, a
 * white SVG logo <img>, social-icon <img>s, the Gutenberg default color palette
 * mixed with the real black/off-white brand colors, and a Google Fonts link.
 */
const HTML = `<!doctype html><html><head>
<title>VIO Med Spa</title>
<meta property="og:image" content="https://x.example/wp-content/uploads/Hero-3-1.jpg" />
<link rel="icon" href="https://x.example/wp-content/uploads/512x512-150x150.png" sizes="32x32" />
<link rel="apple-touch-icon" href="https://x.example/wp-content/uploads/512x512-300x300.png" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&display=swap" />
<style>
  :root { --ink: #030303; }
  .headline { font-family: 'Cormorant Garamond', serif; }
  .wp-1 { color: #0693e3; } .wp-2 { background: #00d084; } .wp-3 { color: #ff6900; }
</style>
</head><body style="background:#fefff9; color:#030303">
  <header><span style="color:#030303">VIO</span></header>
  <p style="color:#030303">Premier med spa. #030303 #030303 #030303</p>
  <div style="border-color:#fefff9; background:#fefff9"></div>
  <img src="https://x.example/wp-content/uploads/vio-logo-white.svg" class="footer__logo-img" alt="VIO Logo white" />
  <img src="https://x.example/wp-content/uploads/facebook.svg" class="social-icon" alt="Facebook Logo" />
  <img src="https://x.example/wp-content/uploads/instagram.svg" class="social-icon" alt="Instagram Logo" />
</body></html>`;

describe("extractHtmlSummary", () => {
  const s = extractHtmlSummary(HTML, "https://x.example/");

  it("picks a real logo (apple-touch-icon), not the og:image banner or a social icon", () => {
    expect(s.logoUrl).toBe("https://x.example/wp-content/uploads/512x512-300x300.png");
    expect(s.logoUrl).not.toContain("Hero-3-1.jpg");
    expect(s.logoUrl).not.toContain("facebook");
  });

  it("drops Gutenberg default-palette noise and surfaces the real brand colors", () => {
    expect(s.colorHints).not.toContain("#0693e3"); // vivid cyan blue (WP default)
    expect(s.colorHints).not.toContain("#00d084"); // vivid green cyan (WP default)
    expect(s.colorHints).not.toContain("#ff6900"); // vivid orange (WP default)
    expect(s.colorHints[0]).toBe("#030303"); // black, most frequent → primary
    expect(s.colorHints).toContain("#fefff9"); // off-white
  });

  it("extracts the Google Fonts family", () => {
    expect(s.fontHints).toContain("Cormorant Garamond");
  });
});
