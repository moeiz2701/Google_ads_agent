# KodoAI Design System

## Editorial Brutalism — Platform-Agnostic Foundation

---

## 1. Design Philosophy

KodoAI employs **editorial brutalism**: a deliberate aesthetic that prioritises clarity, structure, and functional beauty over decoration. No rounded corners. No gradients (except where they serve depth and hierarchy). Typography as primary visual element. Monospace for meta information and technical scaffolding.

**Core principle**: Every pixel should earn its place. The interface should feel like a well-crafted engineering document translated into interactive space.

**This design system works across**: websites, pages, LinkedIn posts, banners, decks, emails, and internal dashboards. All components stem from these foundations.

---

## 2. Colour System

All colours are CSS variables defined in `:root`. This ensures consistency across components and simplifies theme switching.

### 2.1 Neutral Palette

| Variable      | Value     | Purpose                                                       |
| ------------- | --------- | ------------------------------------------------------------- |
| `--bg`        | `#0c0c0b` | Primary background. Near-black, slight warm undertone.        |
| `--surface`   | `#141412` | Primary surface layer. Subtle elevation from bg.              |
| `--surface-2` | `#1a1a18` | Secondary surface. For nested/tertiary sections.              |
| `--surface-3` | `#202019` | Tertiary surface. For densest layering.                       |
| `--border`    | `#2a2a26` | Primary border. Subtle, creates rhythm without noise.         |
| `--border-2`  | `#3a3a34` | Secondary border. Slightly more contrast when layering.       |
| `--ink`       | `#f4f3ee` | Primary text. High contrast, slightly warm white.             |
| `--ink-2`     | `#c4c2b8` | Secondary text. Muted, for supporting copy.                   |
| `--ink-3`     | `#8a887e` | Tertiary text. For labels, meta information, disabled states. |
| `--muted`     | `#5e5c52` | Heavily muted. Reserved for very low-priority text.           |

### 2.2 Accent & Semantic Colours

| Variable       | Value     | Purpose                                                               |
| -------------- | --------- | --------------------------------------------------------------------- |
| `--accent`     | `#c8f060` | Acid lime. Primary call-to-action. Links. Active states. Emphasis.    |
| `--accent-dim` | `#6a802e` | Darker accent. Borders, backgrounds, hover states.                    |
| `--green`      | `#6cd86c` | Success/positive state. Completion, valid input.                      |
| `--green-bg`   | `#1a2a1a` | Green background. Paired with `--green` for contained success states. |
| `--amber`      | `#e8a838` | Warning/attention. Non-critical alerts, cautionary messaging.         |
| `--amber-bg`   | `#2a2010` | Amber background. For warning containers.                             |
| `--red`        | `#e85858` | Error/critical state. Destructive actions, validation errors.         |
| `--red-bg`     | `#2a1414` | Red background. For error containers.                                 |
| `--blue`       | `#78b4e8` | Informational. Secondary call-to-action, supporting data.             |
| `--blue-bg`    | `#142028` | Blue background. For informational containers.                        |

### 2.3 Colour Usage Rules

- **Text on dark**: Always use `--ink`, `--ink-2`, or `--ink-3`. Never use pure white.
- **Accent use**: `--accent` (#c8f060) is reserved for interactive elements, CTAs, and emphasized text. Use sparingly—it must feel intentional, not decorative.
- **Semantic backgrounds**: Always pair colour with a corresponding `-bg` variant. Never use a semantic colour (red, green, amber, blue) directly as a background without its `-bg` pair.
- **Borders**: Default to `--border`. Use `--border-2` for more contrast in dense layouts. Avoid using semantic colours for borders unless indicating a specific state.
- **Disabled/inactive states**: Use `--ink-3` or `--muted` for text; `--border` for borders.

---

## 3. Typography System

### 3.1 Font Stack

| Font                 | Family  | Weights                      | Purpose                                                                                        |
| -------------------- | ------- | ---------------------------- | ---------------------------------------------------------------------------------------------- |
| **Barlow Condensed** | Display | 400, 500, 600, 700, 800, 900 | Headlines, section titles, wordmarks. All caps, tight tracking. Conveys engineering precision. |
| **IBM Plex Sans**    | Body    | 400, 500, 600, 700           | Running text, body copy, component text. Clean, neutral.                                       |
| **IBM Plex Mono**    | Mono    | 300, 400, 500, 600           | Labels, meta information, code snippets, data. Establishes technical authority.                |

### 3.2 Type Scale

| Level               | Font             | Size               | Weight | Line Height | Letter Spacing | Usage                                                                                       |
| ------------------- | ---------------- | ------------------ | ------ | ----------- | -------------- | ------------------------------------------------------------------------------------------- |
| **H1**              | Barlow Condensed | 88px / 56px / 36px | 900    | 0.9         | −0.02em        | Page/section hero. Choose 88px for feature-length, 56px for page sections, 36px for mobile. |
| **H2**              | Barlow Condensed | 56px / 40px / 28px | 800    | 1           | −0.01em        | Major section heading. 56px on desktop/tablet, 28px on mobile.                              |
| **H3**              | Barlow Condensed | 40px / 28px / 20px | 800    | 1.05        | −0.008em       | Subsection heading or card title.                                                           |
| **H4**              | Barlow Condensed | 24px / 18px        | 700    | 1.1         | −0.005em       | Minor heading, label.                                                                       |
| **Body**            | IBM Plex Sans    | 18px / 16px        | 400    | 1.6         | 0.005em        | Running text. Primary content. 18px on desktop, 16px on mobile.                             |
| **Body small**      | IBM Plex Sans    | 16px / 14px        | 400    | 1.6         | 0.005em        | Secondary body copy. 16px on desktop, 14px on mobile.                                       |
| **Label / Eyebrow** | IBM Plex Mono    | 12px / 11px        | 500    | 1.5         | 0.15em         | Form labels, metadata, UI chrome. All caps. Prefix with `//`.                               |
| **Caption**         | IBM Plex Mono    | 13px / 12px        | 400    | 1.8         | 0.05em         | Supporting text, descriptions, footnotes, timestamps.                                       |
| **Code / Snippet**  | IBM Plex Mono    | 13px / 12px        | 400    | 1.6         | 0              | Inline or block code. Keep monospace line-height tight.                                     |

### 3.3 Typography Rules

- **Headlines are typically uppercase.** Barlow Condensed's strength is in its letterforms when uppercase. Sentence case is acceptable for longer headlines (6+ words) where readability is crucial.
- **Never use em dashes.** Use commas, colons, or parentheses for pauses.
- **Monospace for metadata.** Every label, tooltip, and meta field uses IBM Plex Mono. Prefix labels with `//` to establish code-comment aesthetic.
- **Letter spacing is intentional.** Barlow Condensed runs tight (−0.02em to −0.005em). Monospace runs open (0.15em to 0.20em on labels, 0.05em on captions). This contrast reinforces visual hierarchy.
- **Line height ≥ 1.6 for body.** Generous leading improves readability in dark theme and long-form copy.
- **Font smoothing**: Always include `-webkit-font-smoothing: antialiased;` on all text.
- **Responsive scales**: Always provide mobile/tablet variants. Never let headlines be smaller than 20px on mobile.

---

## 4. Spacing & Layout

### 4.1 Base Unit

All spacing is built on a **4px base unit**:

- 4px, 8px, 12px, 16px, 20px, 24px, 28px, 32px, 40px, 48px, 56px, 64px

### 4.2 Padding & Margin

| Purpose          | Value            | Notes                                                      |
| ---------------- | ---------------- | ---------------------------------------------------------- |
| Micro spacing    | 4px, 8px         | Between tightly related elements (button text to icon).    |
| Standard spacing | 12px, 16px       | Standard padding inside containers, gaps between elements. |
| Section padding  | 24px, 32px, 48px | Padding on major containers and sections.                  |
| Section margin   | 40px, 64px       | Margin between major sections.                             |

### 4.3 Grid & Layout

- **Max width**: 1280px for content. Responsive to 100% on mobile with 48px horizontal padding.
- **Container padding**: Horizontal 48px on desktop (full screen), 24px on tablet, 16px on mobile.
- **Section margin**: 64px bottom margin between major sections.
- **Grid systems**: Use CSS Grid where structure is regular (cadence bar, strategy cards). Flexbox for component layouts.

### 4.4 No Border Radius

All elements use `border-radius: 0`. Sharp corners reinforce the brutalist aesthetic and maintain visual clarity.

---

## 5. Core Components

All components use the colour and type system above. No border-radius on any element.

### 5.1 Button

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 20px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--ink-2);
  font-family: var(--mono);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:hover {
  border-color: var(--accent);
  color: var(--ink);
}

.btn.primary {
  background: var(--accent);
  color: var(--bg);
  border-color: var(--accent);
  font-weight: 600;
}

.btn.primary:hover {
  background: var(--accent-dim);
  border-color: var(--accent-dim);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### 5.2 Card / Surface

```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 24px 28px;
}

.card.featured {
  border-color: var(--accent-dim);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}

.card-title {
  font-family: var(--display);
  font-size: 40px;
  font-weight: 800;
  letter-spacing: -0.01em;
  text-transform: uppercase;
  color: var(--ink);
}

.card-meta {
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--ink-3);
}
```

### 5.3 Badge

```css
.badge {
  display: inline-block;
  padding: 8px 12px;
  border: 1px solid var(--border);
  background: transparent;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.badge.accent {
  border-color: var(--accent);
  color: var(--accent);
}

.badge.success {
  border-color: var(--green);
  background: var(--green-bg);
  color: var(--green);
}

.badge.error {
  border-color: var(--red);
  background: var(--red-bg);
  color: var(--red);
}
```

### 5.4 Input Field

```css
.input {
  display: block;
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--ink);
  font-family: var(--sans);
  font-size: 16px;
  line-height: 1.6;
  transition: border-color 0.2s ease;
}

.input:focus {
  outline: none;
  border-color: var(--accent);
}

.input::placeholder {
  color: var(--ink-3);
}

.input:disabled {
  background: var(--bg);
  color: var(--ink-3);
  cursor: not-allowed;
}

label {
  display: block;
  margin-bottom: 8px;
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--ink-3);
}
```

### 5.5 List / Vertical Stack

```css
.list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.list-item {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.list-item-number {
  flex-shrink: 0;
  width: 32px;
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--accent);
}

.list-item-content {
  flex: 1;
}
```

### 5.6 Grid / Two-Column

```css
.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
}

@media (max-width: 768px) {
  .grid-2 {
    grid-template-columns: 1fr;
  }
}

.grid-3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 24px;
}

@media (max-width: 1024px) {
  .grid-3 {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 768px) {
  .grid-3 {
    grid-template-columns: 1fr;
  }
}
```

### 5.7 Divider / Separator

```css
.divider {
  height: 1px;
  background: var(--border);
  margin: 32px 0;
}

.divider.dashed {
  background: none;
  border-top: 1px dashed var(--border-2);
  margin: 20px 0;
}
```

### 5.8 Alert / Message Box

```css
.alert {
  padding: 16px 20px;
  border-left: 3px solid var(--border);
  background: var(--surface-2);
  border-radius: 0;
}

.alert.info {
  border-left-color: var(--blue);
  background: var(--blue-bg);
  color: var(--blue);
}

.alert.success {
  border-left-color: var(--green);
  background: var(--green-bg);
  color: var(--green);
}

.alert.warning {
  border-left-color: var(--amber);
  background: var(--amber-bg);
  color: var(--amber);
}

.alert.error {
  border-left-color: var(--red);
  background: var(--red-bg);
  color: var(--red);
}
```

---

## 6. Usage by Context

### 6.1 Website / Blog

**Layout:**

- Max-width container: 1280px
- Section padding: 48px horizontal (desktop), 24px (tablet), 16px (mobile)
- Section gaps: 64px vertical

**Typography:**

- Use H1 (88px) only once per page for the hero
- Use H2 (56px) for major sections
- Use H3 (40px) for subsections
- Body text: 18px on desktop, 16px on mobile
- Line length: 65–75 characters max for readability

**Components:**

- Cards for feature showcases, testimonials, or product highlights
- Grid-2 or Grid-3 for layout variety
- Buttons paired in 2-button CTA sections (primary + secondary)

### 6.2 LinkedIn Post

**Canvas:**

- Post text: 1–350 words (platform limit)
- Line breaks for rhythm and visual breathing room
- No more than 3–5 paragraphs

**Typography:**

- Lead line: Specific number or bold statement (all caps optional)
- Body: 14–16px effective (platform renders at reader's zoom)
- Emphasis: Use `#c8f060` (accent) sparingly for key words
- Hashtags: 3–5 maximum, bottom of post

**Format patterns:**

- Story: "I watched X happen because Y" — problem → agitate → close
- Insight: Bold observation — evidence → why it matters → question
- How-to: Step-by-step — each step on new line — takeaway

**Links:**

- Keep to 1–2 per post
- Use booking link or article link, not keyword-stuffed anchor text

### 6.3 Banner / Hero Section

**Canvas:**

- Desktop: 1920×1080 (16:9) or 1920×600 (3:1)
- Mobile: 375×667 (9:16) or 375×812 (9:19)
- Tablet: 768×1024 or 1024×768 (flexible)

**Layout:**

- Use split or hero image + text layouts
- Max 2 columns; left text, right visual or vice versa
- Padding: 56px (desktop), 32px (mobile)

**Hierarchy:**

- Eyebrow / label (12px mono, all caps, accent or muted)
- Headline (H1 or H2, 56–88px depending on space)
- Subheading (18–22px, secondary text)
- CTA button (primary style)

**Avoid:**

- Too much text (3 lines max for headline + 2 lines for sub)
- Centered text on mobile (hard to read in split layout)
- More than one primary CTA

### 6.4 Email / Newsletter

**Canvas:**

- Width: 600px (readable on desktop and mobile)
- Padding: 24px sides, 32px top/bottom

**Typography:**

- Subject line: Direct, specific, under 50 chars
- Preheader: 40–50 chars, reinforces subject
- Headline: H2 or H3 (40px)
- Body: 16px, generous line-height (1.6+)
- CTA: Button or underlined link in accent colour

**Rhythm:**

- Intro paragraph (2–3 lines)
- Divider
- Main body (2–3 short paragraphs or list)
- Divider
- CTA section
- Footer (legal, unsubscribe, small meta)

### 6.5 Social Media (Twitter/X, Bluesky)

**Canvas:**

- Text-first, then images
- 280–300 character effective limit per post (X), varies by platform

**Format:**

- Lead with hook (specific number, question, or bold statement)
- Thread format: 3–5 tweets, each 1–2 sentences
- Thread continuation: 1️⃣ 2️⃣ 3️⃣ numbering optional but clear

**Hashtags:**

- 1–3 maximum per post
- Research trending tags relevant to your audience

### 6.6 Case Study / Long-form

**Structure:**

- Hero section (H1, intro, hero image)
- Challenge section (H2, problem statement, metrics)
- Solution section (H2, approach, process, tools)
- Results section (H2, outcomes, metrics, quote)
- CTA section (H3, next steps, link)

**Typography:**

- Use full type hierarchy (H1, H2, H3, body, labels)
- Subheadings every 200–300 words
- Highlight key metrics in accent colour
- Code blocks for technical details (monospace, dark background)

---

## 7. Responsive Design Rules

### Mobile-First Approach

| Breakpoint | Width      | Adjustments                                  |
| ---------- | ---------- | -------------------------------------------- |
| Mobile     | ≤ 768px    | Single-column, 16px padding, 16px type scale |
| Tablet     | 769–1024px | 2-column grid, 24px padding, 18px type scale |
| Desktop    | ≥ 1025px   | Full layout, 48px padding, 18px+ type scale  |

### Rules

- All headings scale down by 8–12px on tablet, another 8px on mobile
- Padding / margin reduce by 50% on mobile, 75% on tablet
- Gaps between elements reduce proportionally
- Single column layouts for all components on mobile
- Touch targets minimum 44×44px (never smaller)
- Line length never exceeds 75 characters on any device

---

## 8. Implementation Checklist

When building any component or page:

- [ ] All text uses colour from the palette (`--ink`, `--ink-2`, `--ink-3`, `--accent`)
- [ ] No `border-radius` on any element
- [ ] Monospace used only for labels, meta, code
- [ ] Display font (Barlow Condensed) only for headlines
- [ ] Sans font (IBM Plex Sans) for all body text
- [ ] Spacing follows 4px base unit (4, 8, 12, 16, 20, 24, 28, 32, 40, 48…)
- [ ] Buttons follow `.btn` pattern (border, hover, primary variant)
- [ ] Cards have 1px border on `--border`, not `--border-2`
- [ ] Focus states defined (at minimum, accent border on inputs)
- [ ] All colours accessible with sufficient contrast
- [ ] Mobile breakpoints defined (max-width: 768px)
- [ ] Font smoothing enabled (`-webkit-font-smoothing: antialiased`)
- [ ] No em dashes in copy
- [ ] Headlines are uppercase or sentence case (never mixed)
- [ ] Hashtags (if applicable) limited to 3–5, never inline

---

## APPENDIX A: Pitch Deck Specific Patterns

This appendix contains design patterns specific to 6-slide pitch decks. These patterns extend the core design system above. They are NOT applicable to websites, LinkedIn posts, or general marketing materials.

### A.1 Deck Design Principles

- **Memo, not marketing.** Slides look like internal technical documents—file IDs, section codes, severity tags. The voice carries the persuasion; the chrome adds credibility.
- **One voltage.** Accent (#c8f060) does all the work—hits in headlines, key numbers, "after" states, primary CTA. Never decorative.
- **Strike-through as argument.** Old/wrong/before states get thick red strike-through; corrected version follows in accent.
- **Meme-as-spec.** Memes (Drake, Distracted Boyfriend) are annotated diagrams with role labels, captions, and figure numbers—not images. Humor through deadpan formality.

### A.2 Deck Canvas

- **Slide size:** 1920×1080 (16:9), fixed
- **Outer letterbox:** pure black (#000)
- **Slide padding:** 56px 96px 48px (airy) / 48px 72px (dense)
- **Layout shell:** flex column with `chrome-top`, content region, `chrome-bottom` pinned via `margin-top: auto`

### A.3 Slide Chrome

**Chrome-top:**

- Flex row, hairline `border-bottom: 1px solid var(--border)`, `padding-bottom: 18px`, `margin-bottom: 48px` (32px dense)
- Left: wordmark + 10px accent dot
- Right: `.meta` row of `LABEL  VALUE` pairs, 32px apart

**Chrome-bottom:**

- `margin-top: auto`, hairline `border-top`, `padding-top: 18px`
- Three columns: left tagline, center sub-tagline, right slide-number in `--ink-2`

### A.4 Deck Layout Grids

| Slide Type   | Grid                     | Gap                 |
| ------------ | ------------------------ | ------------------- |
| Cover        | 2 cols `1.25fr 1fr`      | 72px                |
| Problem      | 2 cols `1.1fr 1fr`       | 72px                |
| Shift frames | 2 cols `1fr 1fr`         | 48px                |
| Pipeline     | 3 cols `220px 1fr 260px` | hairlines           |
| Drake        | 2 cols `260px 1fr`       | 2 rows w/ hairlines |
| CTA          | 2 cols `1.2fr 1fr`       | 80px                |

### A.5 Deck Components

**Badge (`.hook-tag`)**

- `1px solid var(--accent)`, `padding: 8px 14px`
- Mono 12px / 0.20em / UPPER
- Sits above cover headline

**Drake Grid (`.drake-grid`)**

- Left: two stacked `.face` panels, `--red-bg` over `--green-bg`, giant `NO.` / `YES.`
- Right: two `.row` panels. Top row text strike-through `--red`; bottom row uses accent on payoff
- Each row has right-aligned `.metric` with 64px display number above mono label

**Meme Frame (`.meme-frame`)**

- Three-cell diagram inside surface card
- `.meme-cell` with role label, big condensed figure, small sans caption
- `.guy` in `--ink`, `.shiny` in `--accent`, `.gf` in `--red`
- Pure-CSS arrow: 1px line + CSS-border triangle

**Pipeline (`.pipeline`)**

- 3 cols separated by hairlines
- Input column: stacked `.input-card`s
- Agents column: 2×2 grid of `.agent` cards
- Output column: single tall `.output-card` with `--accent-dim` border

**Time Bar (`.time-bar`)**

- 3-col grid `auto 1fr auto`, 6px tall bar on `--border`
- Inline 8%-wide accent fill via `::before`

### A.6 Slide Archetypes

| #   | Class        | Pattern                                                      |
| --- | ------------ | ------------------------------------------------------------ |
| 01  | `.s-cover`   | Hook-tag + strike→hit headline · right-side stat card        |
| 02  | `.s-problem` | Headline + lead + 3-stat row · meme-frame right              |
| 03  | `.s-shift`   | 3-line reframe on `--surface` · two contrasting frames below |
| 04  | `.s-how`     | Headline + lead · 3-col pipeline · time-bar                  |
| 05  | `.s-drake`   | Headline + sub · drake-grid before/after · metrics           |
| 06  | `.s-cta`     | Headline + bullet list · right-side CTA panel + buttons      |

Slide 03 background: `--surface`; all others: `--bg`.

### A.7 Inline Deck Type Treatments

- **`.strike`** — line-through in `--red`, thickness 6–14px. Struck word faded to `--ink-3`.
- **`.hit` / `.accent`** — color set to `--accent`. Replacement / correct / payoff term.
- **`//` prefix** — every mono label prefixed with `// ` (e.g., `// SENDER`, `// 01 · INPUT`). Code comment aesthetic.
- **Section numbering** — chrome top uses `0N · SECTION NAME`; slide-no in chrome bottom uses `0N / 06`.

### A.8 Deck Typography Overrides

For pitch decks only, these sizes override the base scale:

| Context          | Font             | Size  | Weight |
| ---------------- | ---------------- | ----- | ------ |
| Cover headline   | Barlow Condensed | 148px | 900    |
| Default H1       | Barlow Condensed | 180px | 900    |
| Meme cell figure | Barlow Condensed | 80px  | 900    |
| Cover stat       | Barlow Condensed | 72px  | 800    |
| Drake metric     | Barlow Condensed | 64px  | 800    |
| Drake row text   | Barlow Condensed | 52px  | 700    |
| Agent name       | Barlow Condensed | 30px  | 700    |
| Body para        | IBM Plex Sans    | 22px  | 400    |
| Button           | IBM Plex Mono    | 14px  | 500    |

### A.9 Deck Tweaks Panel

A floating panel (bottom-right) exposes runtime knobs:

| Key           | Type      | Options         | Effect                                    |
| ------------- | --------- | --------------- | ----------------------------------------- |
| `accent`      | swatch    | 5 colors        | Rewrites `--accent` on `:root`            |
| `density`     | segmented | airy / dense    | Toggles slide padding + chrome margin     |
| `hookVariant` | segmented | 0 / 1 / 2       | Swaps cover headline + sub copy           |
| `memeMode`    | segmented | brutalist / off | Hides meme frame; collapses grid to 1-col |

---

## APPENDIX B: Quick Reference

### CSS Custom Properties (All)

```css
:root {
  /* Neutrals */
  --bg: #0c0c0b;
  --surface: #141412;
  --surface-2: #1a1a18;
  --surface-3: #202019;
  --border: #2a2a26;
  --border-2: #3a3a34;
  --ink: #f4f3ee;
  --ink-2: #c4c2b8;
  --ink-3: #8a887e;
  --muted: #5e5c52;

  /* Accent & Semantic */
  --accent: #c8f060;
  --accent-dim: #6a802e;
  --green: #6cd86c;
  --green-bg: #1a2a1a;
  --amber: #e8a838;
  --amber-bg: #2a2010;
  --red: #e85858;
  --red-bg: #2a1414;
  --blue: #78b4e8;
  --blue-bg: #142028;

  /* Fonts */
  --display: "Barlow Condensed", Impact, sans-serif;
  --sans: "IBM Plex Sans", -apple-system, system-ui, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
}
```

### Spacing Scale (4px base unit)

`4px` · `8px` · `12px` · `16px` · `20px` · `24px` · `28px` · `32px` · `40px` · `48px` · `56px` · `64px`

### Breakpoints

- Mobile: ≤ 768px
- Tablet: 769–1024px
- Desktop: ≥ 1025px

---

**Version:** 1.0  
**Last updated:** May 2026  
**Status:** Platform-agnostic, production-ready
