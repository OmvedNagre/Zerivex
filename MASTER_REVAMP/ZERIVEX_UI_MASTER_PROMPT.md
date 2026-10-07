# ZERIVEX — UI Master Prompt (v2: "Ember & Paper")

> **Attach with:** `ZERIVEX_SYSTEM_AND_UI_ARCHITECTURE_SPEC.md` and `ZERIVEX_Master_Pricing_Monetization_Prompt.md`.
> **Agent:** Antigravity (Gemini flash, high) with the *impeccable* and *GSAP* skills enabled.
> **Job:** Redesign the entire ZERIVEX frontend so it feels fresh, friendly and fun, while staying 100% wired to the existing backend.

---

## 0. HOW YOU MUST WORK (read first, obey always)

1. **Work in phases (Section 12). Finish one phase, run the checks, post a short report, then continue.** Do not start Phase N+1 with failing checks.
2. **Never guess file names, routes, field names or API shapes.** Before each phase, run `ls`, `rg`, and open the real files. If something in the spec is missing from the repo, say so in your report instead of inventing it.
3. **Backend is frozen.** No changes under `src/core/`, `src/app/api/`, DB migrations, or env contracts. Frontend-only. If a component "wants" data the backend lacks, use the fallback rule in Section 3.4.
4. **All 269 existing tests must stay green.** Run the test, lint and typecheck commands from `package.json` at the end of every phase.
5. **No Tailwind.** The codebase uses Vanilla CSS with CSS custom properties. Do not add Tailwind, shadcn's CLI, or `tailwind-merge`. (See Section 6 for how to use shadcn/ui *without* Tailwind.)
6. **Every data-bearing component gets its props from a typed adapter** in `src/adapters/`. Components never read raw API responses.
7. **Use the skills:** at the end of each phase run an *impeccable* critique/polish pass on what you built, and use the *GSAP* skill for all scroll/entrance animation. Where a skill's default taste conflicts with this document's tokens or constraints, **this document wins**; where it only adds anti-"AI-slop" guidance, follow the skill.
8. **Report format after each phase** (max 15 lines): files changed · what now works · checks run + results · anything you could not do and why.

---

## 1. WHO THIS IS FOR (design for this person)

**The user:** a founder or solo dev who built their site with an AI tool (Cursor, Lovable, v0, Bolt, Claude Code), shipped fast, and has **never looked at security**. They are not a security expert. They are slightly anxious, short on time, and allergic to jargon and walls of red alerts.

**What they need to feel, in order:**
1. *"This is approachable, not scary."*
2. *"It found something real, and I understand it."*
3. *"It told me exactly what to paste to fix it."*
4. *"It confirmed it's fixed."*

**Brand lines (use these, they come from the product docs):** "Security for software built with AI." and "Verify. Detect. Defend."

**Voice:** plain, warm, confident, a little wry. Technical terms always get a one-line human translation.
- Say: "Your API keys are visible to anyone who opens DevTools."
- Not: "Client bundle secret exposure detected (CWE-798)."
- Show the CWE/OWASP/rule ID as small secondary chips, never as the headline.

**Hero copy (use option A unless I say otherwise):**
- **A.** H1: "You shipped fast. Let's check what shipped with it." Sub: "Zerivex scans your AI-built app for leaked keys, open CORS, missing headers and injection bugs, then gives you the exact fix for Next.js, Express or Nginx."
- **B.** H1: "Vibe-coded. Now vibe-checked." (same sub)
- **C.** H1: "Find the security holes your AI forgot." (same sub)

---

## 2. THINGS IN THE CURRENT SITE YOU MUST FIX OR CHALLENGE

Do these; they are not optional.

| # | Problem | Required action |
|---|---|---|
| 1 | **"3 Issues" Next.js dev badge** is showing on the current build. Likely a hydration mismatch (theme or banner state read from `localStorage` during render). | **Phase 0:** click the badge, read each error, fix them. Never read `localStorage`, `window` or `Date.now()` during render. Use a mounted flag or `useSyncExternalStore` with a server snapshot. |
| 2 | **Theme toggle** | Remove `ThemeToggle` everywhere (header, login). Remove the theme-init script. Ship **one light theme** (Section 4). Park the dark token block in an un-imported `tokens.dark.css` so it can return later. Set `color-scheme: light`. |
| 3 | **Fabricated testimonial** ("94% reduction in PR security review cycle time"). | Do **not** ship invented customer claims. `TestimonialMetric` must render **nothing** when the testimonial list is empty. Only render items supplied from real data. |
| 4 | **Hardcoded claims** ("269 tests passing", "10/10 subsystems cryptographically verified", "detection accuracy"). | Test counts and "verified" claims must come from a real source (build-time artifact or health endpoint) or be removed. Do not say "cryptographically verified" about subsystems; the audit vault is *tamper-evident* (hash/monotonic checks). Use that wording. |
| 5 | **Landing page "live scan leaderboard"** would show other customers' scans to the public. | Never show hostnames or per-customer data on public pages. Landing-page numbers come only from static catalogs (14 checks, 31+ rules, 4 ownership methods, 10 academy guides) and `GET /api/health`. Per-user totals appear only when the visitor is signed in. |
| 6 | **Component names say "Semrush"** (`HeroSemrush`, `FooterSemrush`, etc.) and docs mention Semrush Intergalactic. | Rename to neutral names (`Hero`, `Footer`, `StatsRow`, ...). Update imports. Remove any user-facing mention of Semrush. |
| 7 | **Plan model mismatch.** Architecture spec lists 3 plan IDs (`FREE_DEVELOPER`, `TEAM_PRO`, `ENTERPRISE`). Pricing prompt defines 5 (Free, Starter, Pro, Team, Enterprise) with credits. | Find the real plan config in the repo (`rg -i "starter|entitlement|credit" src/`). Build **one** `adaptPlans()` adapter that every plan UI (pricing page, billing page, upgrade nudges) uses. Plan count and prices must never be hardcoded in JSX. Report which model is actually live. |
| 8 | **Emoji and text glyphs** (✓ ✕ → ⚠ etc.) in UI. | Replace with **Lucide icons** (Section 5.3). Find them: `rg -nP "[\x{1F300}-\x{1FAFF}\x{2190}-\x{21FF}\x{2600}-\x{27BF}]" src/`. Allowed exceptions: `⌘` inside keyboard hints and `₹`. |
| 9 | **White text on orange `#ff642d`** is about 3:1 contrast and fails WCAG AA for normal text. | Brand buttons use **ink text (`#191B23`) on ember orange** (about 5.9:1). Never white-on-`#ff642d` for text under 24px. |
| 10 | **Two filled-orange buttons** in one viewport (header + hero) plus orange text links. | One Brand button per viewport. When the hero is on screen, the nav CTA is secondary style; it becomes Brand after the hero scrolls out. |
| 11 | **Fake demo output** (hero terminal shows canned `14ms PROTECTED` lines). | Terminal content must be derived from the real check catalog via an adapter, or carry a visible "Sample output" label. Never imply it is a live scan of the visitor's site. |

---

## 3. NON-NEGOTIABLE ENGINEERING RULES

### 3.1 Stack facts (from the spec)
Next.js 15 App Router · React 19 · Vanilla CSS with custom properties · tokens in `src/styles/semrush-tokens.css` (rename to `tokens.css`) · adapters in `src/adapters/semrush-adapters.ts` (rename to `adapters.ts` or split by domain) · edge auth protects `/dashboard/*` (keep it).

### 3.2 No Fake Security (from the pricing prompt, §21)
Never show a capability as working unless it is implemented and tested. Use a **"Coming soon"** pill or remove it. See the Capability Truth Table in Appendix A. If the config flag says `enabled: false`, or the capability is not in Appendix A's *Implemented* column, it is **Coming soon**.

### 3.3 Server enforces, UI explains
Frontend gating is UX only. Never trust client-side plan names or credit balances. Read them from `GET /api/billing` through an adapter.

### 3.4 Dynamic-data fallback rule
Every component must handle: loading (skeleton, no layout shift) · empty (helpful message + one action) · error (inline + retry) · 1 item / 3 items / 50 items · 2-character and 200-character strings · missing image/icon · RTL-safe CSS (use logical properties).
If a field is missing: derive it, substitute a Lucide icon/tile, or hide that part. **Never invent content and never leave a visual hole.**

### 3.5 Performance & a11y
Landing page: LCP under 2.5 s, no layout shift. Contrast at least 4.5:1 for text. Visible 3 px focus ring. 44 px touch targets on mobile. Everything keyboard-operable. `prefers-reduced-motion` disables Lenis, marquee and all GSAP motion (content must still be fully usable and visible).

---

## 4. CREATIVE DIRECTION: "EMBER & PAPER"

**Concept:** a warm paper-like canvas (friendly, calm, human) with **dark terminal "islands"** (technical, credible) and **one ember-orange accent** (the single action color). It feels like a friendly engineer's notebook with a real console in the middle of it. Not another dark-mode-gradient security site, not a cold blue enterprise dashboard.

Style references to open on Refero Styles for mood only (do not clone): *Brex* ("white concrete, single ember"), *Vercel* ("typeset terminal on white paper"), *Cursor / Intercom / Notion* (warm cream editorial).

### 4.1 Tokens (put in `tokens.css`; keep existing `--orange-*`, `--gray-*`, `--green-*`, `--red-*`, `--yellow-*`, `--violet-*`, `--blue-*` base palette; keep the existing `--sev-*` severity tokens)

```css
:root {
  color-scheme: light;

  /* Surfaces: warm paper */
  --ds-bg-page:        #FBF8F3;
  --ds-bg-subtle:      #F4EFE7;
  --ds-bg-card:        #FFFFFF;
  --ds-bg-card-hover:  #FFFDF9;
  --ds-bg-ink:         #14161C;   /* terminal / inverse islands */
  --ds-bg-ink-raised:  #1C1F27;

  /* Text */
  --ds-text-primary:   #191B23;
  --ds-text-secondary: #484A54;   /* paragraphs (gray-600) */
  --ds-text-muted:     #6C6E79;   /* captions only (gray-500) */
  --ds-text-on-ink:    #E9EAF0;
  --ds-text-on-ink-dim:#A9ABB6;

  /* Borders: warm hairlines */
  --ds-border-subtle:  #ECE5D9;
  --ds-border-default: #DDD3C2;
  --ds-border-strong:  #B9AD98;

  /* Actions */
  --ds-action-brand:        #FF642D;   /* ember: ONE per viewport */
  --ds-action-brand-hover:  #FF8C43;
  --ds-action-brand-press:  #C33909;
  --ds-on-brand:            #191B23;   /* ink text on ember (AA) */
  --ds-action-link:         #006DCA;

  /* Friendly accents ("stickers"), used for chips and illustration only */
  --ds-mint:   #59DDAA;  --ds-mint-bg:   #DBFEE8;
  --ds-butter: #FDC23C;  --ds-butter-bg: #FDF7C8;
  --ds-lilac:  #C695FF;  --ds-lilac-bg:  #F3E8FF;

  /* Status */
  --ds-success: #009F81;  --ds-warning: #D87900;  --ds-danger: #D1002F;  --ds-info: #008FF8;

  /* Focus */
  --ds-focus-ring: 0 0 0 3px rgba(0,143,248,.45);

  /* Radius: friendlier than before */
  --ds-radius-sm: 8px; --ds-radius-md: 12px; --ds-radius-lg: 20px; --ds-radius-xl: 28px; --ds-radius-pill: 999px;

  /* Warm, soft shadows + one playful "sticker" shadow */
  --ds-shadow-1: 0 1px 0 rgba(25,27,35,.04), 0 1px 2px rgba(25,27,35,.06);
  --ds-shadow-2: 0 10px 28px -14px rgba(120,80,30,.28);
  --ds-shadow-3: 0 24px 56px -20px rgba(25,27,35,.30);
  --ds-shadow-sticker: 4px 4px 0 var(--ds-text-primary);

  /* Spacing: keep existing 4px scale --ds-space-1..10 */
  --ds-ease: cubic-bezier(.2,.8,.2,1);
}
```

Page canvas may carry a very faint paper grain or dotted grid (`radial-gradient` dots at 4% opacity). No purple-blue gradient hero glows, no glassmorphism.

### 4.2 Typography (load with `next/font/google`; no external CSS requests)
- **Display / headings:** *Bricolage Grotesque* (weights 600–800). Characterful, friendly, not the default AI look.
- **Body / UI:** *Geist* (fallback *Inter*).
- **Mono (terminal, code, rule IDs, numbers in tables):** *JetBrains Mono* (already in use).
- Scale: H1 `clamp(40px, 6vw, 72px)` / 1.04, tight tracking (`-0.02em`) · H2 `clamp(30px, 4vw, 48px)` · H3 24 · body 16/26 · small 14/20 · eyebrow 12 uppercase `0.08em`.
- Numerals in tables, stats and scores: `font-variant-numeric: tabular-nums`.
- If a font fails to build, fall back to the stack and tell me; do not substitute silently.

### 4.3 Fun budget (this is what makes it feel alive; keep it purposeful)
Do these, and **only** these. Each must also work with motion disabled.
1. **Live URL-to-terminal hero.** The visitor types their URL into the hero input; the terminal's `$ zerivex scan --target=…` line updates as they type (see 7.3).
2. **Sticker hovers.** Cards lift 4 px and swap to `--ds-shadow-sticker` with a tiny (±0.6°) tilt. Buttons press down 2 px.
3. **Spotlight bento tiles.** A soft radial highlight follows the cursor inside bento cards (pointer devices only).
4. **Score gauge sweep.** Circular score gauges animate from 0 to value once on first view.
5. **Severity stamp-in.** Severity chips "stamp" in (scale 1.15 → 1, 140 ms) when a findings list loads.
6. **Copy → check morph.** Every copy button swaps `Copy` icon to `Check` for 1.6 s and fires a toast.
7. **Before/after fix toggle** with a draggable divider or a two-state switch.
8. **Count-up stats** on first view (final value in the DOM from the start for SSR/no-JS).
9. **Sticky scroll story** (Verify, Detect, Defend) on the landing page.
10. **Command palette** (`⌘K` / `Ctrl K`) in the dashboard.

Banned: confetti, bouncing mascots, countdown timers, fake urgency, parallax everywhere, autoplay video, cursor trails, typewriter on every heading.

---

## 5. LIBRARIES & SETUP

### 5.1 Lenis (smooth scroll)
```bash
npm i lenis
```
```tsx
// src/components/motion/SmoothScroll.tsx
'use client';
import { ReactLenis } from 'lenis/react';
import 'lenis/dist/lenis.css';
import { useEffect, useState } from 'react';

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setEnabled(!mq.matches);
    const on = () => setEnabled(!mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  if (!enabled) return <>{children}</>;
  return <ReactLenis root options={{ lerp: 0.1, smoothWheel: true, autoRaf: true }}>{children}</ReactLenis>;
}
```
Rules:
- Mount it in the **marketing layout only** (`/`, `/pricing`, `/academy/*`, `/login`). **Do not mount it in `/dashboard/*`** (data-dense screens, many inner scrollers).
- Add `data-lenis-prevent` to every inner scroll area on marketing pages: modals, drawers, mega-menu panel, code blocks, wide tables, command palette.
- When a Radix dialog or drawer opens, also call `lenis.stop()` and `lenis.start()` on close (`useLenis()`).
- Anchor links: use `lenis.scrollTo('#id', { offset: -96 })`. Keep `scroll-padding-top: 96px` on `html` for no-JS.
- **With GSAP ScrollTrigger:** set `autoRaf: false`, then `gsap.ticker.add((t) => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0); lenis.on('scroll', ScrollTrigger.update);`. Verify against the current Lenis docs and your GSAP skill before wiring.

### 5.2 GSAP
Use for: hero entrance, sticky scroll story, count-ups, gauge sweep, stamp-ins. Register plugins in a single client util; `gsap.context()` + cleanup in effects; `matchMedia` for reduced motion. Keep each animation under 700 ms (except the sticky story). Animate only `transform` and `opacity`.

### 5.3 Lucide icons (replace ALL emoji and glyph-icons)
```bash
npm i lucide-react
```
Defaults: `strokeWidth={1.75}`, size 16 (inline) / 20 (buttons, nav) / 24 (feature tiles). Decorative icons: `aria-hidden="true"`. Icon-only buttons need `aria-label`. If a name below does not exist in the installed version, check lucide.dev for the renamed icon (e.g. `AlertTriangle` became `TriangleAlert`).

| Concept | Icon | Concept | Icon |
|---|---|---|---|
| Brand / verified | `ShieldCheck` | Critical | `OctagonAlert` |
| High | `TriangleAlert` | Medium | `CircleAlert` |
| Low / Info | `Info` | Scan / scanner | `ScanSearch`, `Radar` |
| Ownership verify | `Fingerprint` | Secrets / API keys | `KeyRound` |
| SSRF egress | `Network` | TLS / HTTPS | `Lock` |
| Headers | `FileCode` | CORS | `Globe` |
| Injection | `Bug` | AI code smells | `Bot` |
| Terminal / CLI | `Terminal` | CI/CD | `GitBranch` |
| Webhooks | `Webhook` | Audit vault | `ScrollText` |
| Academy | `GraduationCap` | Team | `Users` |
| Agency | `Building2` | Billing | `CreditCard` |
| Score | `Gauge` | Schedule | `CalendarClock` |
| Copy / Done | `Copy` / `Check` | Close | `X` |
| Expand | `ChevronDown` | CTA arrow | `ArrowRight` |
| External | `ExternalLink` | Coming soon | `Hourglass` |
| Locked feature | `Lock` | Search | `Search` |

### 5.4 shadcn/ui WITHOUT Tailwind
shadcn/ui is Radix primitives + Tailwind classes. We keep Radix and the **shadcn anatomy and behavior**, and style it with our CSS tokens.
```bash
npm i @radix-ui/react-dialog @radix-ui/react-tabs @radix-ui/react-accordion \
      @radix-ui/react-dropdown-menu @radix-ui/react-tooltip @radix-ui/react-switch \
      @radix-ui/react-slider @radix-ui/react-popover @radix-ui/react-progress \
      @radix-ui/react-toggle-group cmdk sonner vaul
```
- Build a small `src/components/ui/` kit: `Button, Badge, Card, Dialog, Tabs, Accordion, DropdownMenu, Tooltip, Switch, Slider, Progress, Popover, Toast (sonner), CommandPalette (cmdk), Drawer (vaul), Table, Skeleton, EmptyState, CodeBlock, CopyButton, SeverityBadge, ScoreGauge, UpgradeNudge`.
- Mirror shadcn's variant API (`variant`, `size`) with plain CSS classes (`.btn`, `.btn--brand`, `.btn--ghost`...). One CSS file per component or CSS Modules. No inline hex values; only tokens.
- Check ui.shadcn.com for each component's **structure, props, keyboard behavior and a11y notes**, then implement the Radix version. Do not copy Tailwind class strings.

---

## 6. REFERENCE MAP: WHAT TO TAKE FROM EACH SITE (and where)

Open each, study, then **adapt** with our tokens. These are inspirations, not templates to clone. vibeprompts.dev outputs Tailwind snippets, so convert the structure to our CSS.

| Source | What it is | Take this | Use it on |
|---|---|---|---|
| **vibeprompts.dev** (286 layout prompts) | Prompt library by section | Pricing: *Three-tier with highlight*, *Comparison table*, *Credit pack top-up*, *Enterprise quote request panel*. Hero: *Search-first*, *Install command*. Features: *Bento grid*, *Hover-to-preview feature list*, *Sticky visual with scrolling steps*, *Before and after split*, *API block with language tabs*, *Security and compliance panel*, *Architecture flow diagram*. Stats: *Count-up metrics*, *Ring gauge trio*, *Uptime status strip*. Nav: *Floating pill nav*, *Nav with announcement bar*, *Shrink-on-scroll nav*, *Anchor nav with scroll spy*. CTA: *Two-path CTA split*, *In-app upgrade nudge*, *Seat limit collaboration nudge*, *Trial CTA with reassurance*. Footer: *Oversized wordmark*, *Footer with status and region*, *Footer with overlapping CTA card*, *Command-line product footer*. FAQ: *Billing FAQ with plan recap*, *FAQ with category rail*. Dashboard/Bonus: *Usage and billing meters*, *Command palette*, *One-time API key reveal*, *Webhook delivery inspector*, *Cron schedule builder*, *Type-to-confirm delete dialog*, *Log viewer with live tail*, *Skeleton loading*, *Empty state*, *Active sessions manager*, *Team and roles admin*. Onboarding: *Checklist card*. Blog: *Guide library with difficulty tags*, *Article with sticky contents*. Auth: *Split-screen with visual*. | Everywhere (see Section 7) |
| **ui.shadcn.com** | Component library | Anatomy, variants, a11y of Button, Badge, Card, Dialog, Tabs, Accordion, Table, Command, Sonner, Drawer, Progress, Slider, Switch, Tooltip | `src/components/ui/` |
| **pricingpages.design** | Pricing page gallery | Plan card hierarchy, highlight treatment, toggle, comparison layout, FAQ placement, honest annual savings display. *(The exact URL was entered with a typo in my notes: browse the domain root.)* | New `/pricing` page |
| **styles.refero.design** | Real sites as DESIGN.md files | Mood only: warm paper, single ember accent, terminal islands | Theme (Section 4) |
| **navbar.gallery** | Navbar patterns | Floating pill, mega-menu panel behavior, mobile drawer, scroll-shrink | Header |
| **supahero.io** | Hero section gallery | Hero composition: headline weight, input-led hero, product-in-hero framing | Landing hero |
| **cta.gallery** | CTA section gallery | End-of-page CTA, two-path CTA, reassurance microcopy | CTA bands |
| **footer.design** | Footer gallery | Oversized wordmark, status row, column rhythm, legal row | Footer |
| **hoverstat.es** | Gallery of experimental sites | Delight micro-interactions only: hover-toggle, dial/stepper nav, tactile hovers. Use *one or two* ideas sparingly | Fun budget (4.3) |

*Browse these live with your browser tool. If a site is unreachable, use the pattern names above and say so in your report.*

---

## 7. COMPONENT & PAGE SPECS

Each block lists **pattern → data source (adapter) → behavior/states**. Adapters live in `src/adapters/`. Names below are suggestions; reuse existing ones from the spec where they already exist (`adaptArticlesToResources`, `adaptStats`, `adaptSolutionsFromChecks`).

### 7.1 Global chrome

**AnnouncementBar** · slim ink strip (`--ds-bg-ink`) · message from a single config/const (e.g. "New: Fix verification re-tests only the failing check") · dismissible; dismissal stored in a cookie or `localStorage` **read after mount only** · hidden until mounted to avoid hydration mismatch.

**Header (FloatingPillNav)** · *Floating pill nav + shrink-on-scroll + mega panel* · detached rounded bar, 12 px from top, paper background with hairline border, blur-free · Items: **Platform** (mega panel), **Teams** (panel), **Pricing**, **Academy**, **Security.txt** · Right: `Sign in` (ghost) + CTA. CTA text: "Scan my site" (unauthenticated) / "Go to dashboard" (authenticated via `useAuth()`). Brand style only after the hero scrolls out (IntersectionObserver); before that, secondary.
- **Platform mega panel** groups (all real features from the spec): *Detect* (Scanner battery, Attack surface, AI code smells) · *Verify & Defend* (Target ownership, SSRF egress shield, Fix catalog + Verify Fix) · *Ship safely* (CI/CD quality gates, SARIF, Webhooks, API keys) · *Prove it* (Audit vault, Reports). Each link: Lucide icon + title + one-line description. Include a small promo tile at the bottom: "Free scan: no card needed" → hero URL input.
- Mobile: `vaul` drawer with accordion groups; focus trap; `data-lenis-prevent`.
- Scroll spy on `/pricing` and long pages (*Anchor nav with scroll spy*).

**Footer** · *Oversized wordmark + overlapping CTA card + status row + command-line touch* · giant "ZERIVEX" wordmark cropped at the bottom, link columns (Product, Developers, Learn, Company, Legal), `security.txt` link, system status pill (Lucide `CircleDot`, color from `GET /api/health`: ok / degraded / down; skeleton if loading) · small mono line `$ curl -I https://<site>` as a wink (decorative, `aria-hidden`).

**Toasts** (`sonner`), **Command palette** (`cmdk`, dashboard only; routes + registered targets), **Skeleton**, **EmptyState** (Lucide icon + one sentence + one action).

### 7.2 Landing page `/` (order matters)

Keep all existing backend wiring from spec 7.1. New order:

1. **AnnouncementBar**
2. **Header**
3. **Hero** (7.3)
4. **Verify. Detect. Defend. sticky story** (7.4)
5. **"Mistakes AI tools leave behind" Bento + hover-to-preview list** (7.5)
6. **Before/after fix split with Next.js / Express / Nginx tabs** (7.6)
7. **Works-with strip** (marquee; text/logo chips for Next.js, React, Express, Nginx, Node.js, Fastify; plus text chips "Built with Cursor, Lovable, v0, Bolt or Claude Code? Start here." as plain text, no third-party logos)
8. **CI/CD band** (inverse ink panel; tabs GitHub Actions / GitLab CI / cURL using the same snippet generator as dashboard 7.9; mentions SARIF and PR summaries)
9. **Stats + subsystem status** (ring gauge trio + count-up; see rules below)
10. **Proof** (`TestimonialMetric`: renders only if real testimonials exist; else render a "How we verify fixes" explainer card instead)
11. **Academy preview** (*Guide library with difficulty tags*; 6 cards from `adaptArticlesToResources()`; track chips, difficulty, reading time, CWE chip)
12. **Pricing teaser** (reuse `PricingTiers` from Section 8, compact)
13. **FAQ** (*FAQ with category rail*; real answers from the spec: Is scanning safe? Why verify ownership? Will active scans break my app? What do you store and redact? What do I get free? What is a credit?)
14. **Final CTA card overlapping the footer** (*Two-path CTA split*: "Scan my site free" vs "Talk to Security Team"; reassurance microcopy from real facts only)
15. **Footer**

**Stats rules (public page):** only catalog-derived numbers: *Check engines* (count from the scanner check registry/`adaptSolutionsFromChecks`), *Fix recipes* (count from the remediation catalog), *Ownership methods* (4), *Academy guides* (count from `ACADEMY_ARTICLES`). Add `GET /api/health` for the status strip. **Do not** show total scans across customers. If a number can't be computed, hide the tile.

### 7.3 Hero (the signature moment)

- **Layout:** left-aligned on desktop (centered on mobile), warm paper canvas. Eyebrow pill (Lucide `ShieldCheck` + "Security for software built with AI"). H1 (copy A), sub, then the **URL scan bar**: one large input (`https://your-app.com`) + Brand button "Run free scan" + small helper "Free plan includes 1 public scan per week" (read the number from the plan config, never hardcode).
- **Behavior (frontend only):** on submit, validate URL client-side (http/https only). If unauthenticated: `router.push('/login?returnTo=' + encodeURIComponent('/dashboard/targets?new=' + encodeURIComponent(url)))`. If authenticated: go to `/dashboard/targets?new=<url>`. In the dashboard, the Targets page reads `new` and opens the *Register New Target* modal pre-filled. (Small frontend change in the dashboard page; no API change.)
- **Terminal island** (right or below): `--ds-bg-ink`, mono, window dots in muted tones (not red/yellow/green traffic lights). Header `zerivex-cli`. Three tabs (*Passive audit · Ownership verify · Fix & re-verify*). The command line `$ zerivex scan --target=<typed url or example.com> --profile=strict --sarif` **updates live as the visitor types**. Output rows come from the real check catalog (`id`, `name`, `mode`, severity range) via adapter, labeled **"Sample output"** in a small chip. No fake milliseconds or fake "PROTECTED" statuses presented as results for their site.
- **Trust chips** under the form (Lucide icons): "14 check engines" · "31+ fix recipes" · "Ownership-verified active scans". Counts from catalogs.
- **Motion:** staggered word reveal on H1 (GSAP, 500 ms), terminal rows fade-in in sequence. Disabled under reduced motion.

### 7.4 "Verify. Detect. Defend." sticky scroll story
*Pattern: Sticky visual with scrolling steps + Architecture flow diagram.* Left column scrolls three steps; right column sticky panel (ink island) changes per step.
- **Verify** (Fingerprint): "Prove it's your site first." Show the four ownership methods (DNS TXT, HTTP header, HTML meta, file upload) as a mini tab; display the real token format `zx_verify_<hex>` as an example.
- **Detect** (ScanSearch): passive vs active modes; list of check families; mention evidence is redacted.
- **Defend** (ShieldCheck): exact before/after code, "Verify Fix Now" re-tests only that check, continuous monitoring catches score drops of 10+ points.
Each step scrubs the right panel with GSAP ScrollTrigger (works with Lenis). On mobile, steps stack with their visuals inline.

### 7.5 Bento grid + hover-to-preview
Data: `adaptSolutionsFromChecks(checks)` grouped into **Secrets, Headers & TLS, CORS & Cookies, Injection, API exposure, AI code smells**. Bento tiles of varied size; each tile: Lucide icon, plain-English headline ("API keys visible in your JS bundle"), 1-line explanation, small chips: severity range and rule prefix (`ZX-SEC-*`). Hover (desktop): spotlight follows the cursor; a side preview shows what the check looks for. Mobile: simple stacked cards. Tile count follows the data (no hardcoded number).

### 7.6 Before/after fix split
Pick 2–3 rules from the remediation catalog by adapter (prefer one each of Headers, CORS, Secrets). Left = "Before" (red-tinted code card), right = "After" (mint-tinted). `CodeBlock` with copy button and a framework **tab group (Next.js · Express · Nginx)** as in *API block with language tabs*. Show CWE/OWASP chips and the copy-paste CLI verify command. A static diff only: **no fake "Verify" button here**. CTA: "Verify this on your site".

### 7.7 Academy `/academy` and `/academy/[slug]`
- **Hub:** *Guide library with difficulty tags*. Keep every existing control (search, category pills, track selector, difficulty filter, "Showing X of Y guides"). Cards: track badge, difficulty chip (Lucide dots), reading time (`Clock`), CWE chip. Add a *Choose-your-path* strip: the 4 tracks as large selectable cards (counts computed).
- **Article:** *Article with sticky contents*: sticky TOC on the left, reading progress bar at top, metadata bar, sections 1–6 exactly as in the spec. Dangerous vs remediated code = **Before/After toggle** with copy buttons. CLI steps in a terminal island. Quiz: instant feedback with Lucide `Check`/`X` and a short explanation; no confetti. Bottom CTA: "Launch scan for this vulnerability".

### 7.8 Auth `/login`
*Split-screen with visual.* Left: heading, GitHub and Google buttons (Lucide icons, not logos you don't have rights to; use simple-icons or text if needed), Dev Localhost login **only when the existing code already gates it to non-production**, error banner, return-URL support. Right: ink island titled "What happens next" with 3 steps (Register target, Verify ownership, First scan) as a progress list. Back-to-home link top-left. **No theme toggle.**

### 7.9 Dashboard (restyle + a few new UX layers; same routes, same APIs)

Keep every feature in spec sections 7.5–7.17. Apply tokens, radii, Lucide, `ui/` kit. Lenis **off**.

- **Shell:** left rail with Lucide icons and groups (*Overview · Targets · Scans · Findings · Audit Vault · Team · Agency · Billing · Settings*), workspace switcher (*Workspace switcher nav*), breadcrumbs, `⌘K` palette, avatar menu. Collapsible to icons.
- **First-run checklist card** on Dashboard Overview (*Onboarding checklist card*). Steps computed from real state: *Register a target (targets > 0) · Verify ownership (any VERIFIED) · Run a first scan (any COMPLETED) · Fix a finding (any FIXED) · Add a CI quality gate (policy exists)*. Hide when all done. No fake progress.
- **CommandBanner:** score gauge ring (0–100, grade letter per spec brackets A+/A/B/F), greeting, quick actions.
- **Metric cards (4):** keep the four from the spec. Severity pills use `--sev-*` tokens plus Lucide icons (never color-only).
- **Subsystem status strip:** Lucide icons + pulse dot; values from `/api/health`.
- **Scans table:** RUNNING row has a subtle pulse; polling every 3 s stays. Add *Log viewer with live tail* style panel only if the backend already returns progress/log text; otherwise skip.
- **Findings:** accordion cards, severity stamp-in, evidence JSON in a collapsible mono panel. `FrameworkRemediationModal`: Radix tabs (Next.js · Express · Nginx), copy buttons, and the **real** "Verify Fix Now" result shown as an inline status panel (spinner → success/failure + diagnostic text from the API).
- **Risk acceptance modal:** required justification field with counter.
- **Targets:** `VerificationCenter` as a numbered stepper with copy-chips for token/host/header/meta; "Check verification now" with spinner. **Delete target** uses *Type-to-confirm delete dialog*.
- **Monitoring:** score history line chart in our tokens (use the existing chart lib or inline SVG), alerts table, schedule modal using a *Cron schedule builder* (plain-English controls that emit the `frequency` and `cronExpression` the API already accepts).
- **CI/CD gate page:** sliders and switches (Radix), snippet tabs (GitHub Actions · GitLab CI · cURL) with copy.
- **Audit Vault:** filter bar, table, JSON drawer (`vaul`), "Verify hash chain integrity" button with a clear success/failure panel, export dropdown (CSV / SIEM JSON). Use the phrase *tamper-evident*.
- **Team:** roster table with role badges, invite modal, pending invites, ownership transfer in a confirm dialog (*Team and roles admin*).
- **Agency:** portfolio metric strip, clients grid, provision modal, branding form with a **live preview** of the generated report header (color picker + logo URL + footer text).
- **Billing:** *Usage and billing meters* (targets, scans, members, plus credits if the config exposes them), plan cards from `adaptPlans()`, "Manage billing in Stripe". See Section 9 for downgrade explanations.
- **Settings → API keys:** *One-time API key reveal* modal (shown once, copy gate, clear warning). **Webhooks:** deliveries as a *Webhook delivery inspector* (status code, latency, signature, payload drawer). **Security:** *Active sessions manager* style list + "Sign out of all devices".
- **Empty/loading/error states** for every table and card.

---

## 8. PRICING PAGE `/pricing` (NEW; not on the site today)

**Pattern:** vibeprompts *Three-tier with highlight* + pricingpages.design hierarchy. Structure from the pricing prompt (§15):

`Hero → Monthly/Annual toggle → Plan cards → Feature comparison → Credit explanation → Security capability matrix → FAQ → Final CTA`

### 8.1 Layout (config-driven)
- **Hero:** H1 "Free proves the problem. Paid fixes it for good." Sub: "Start with a free scan. Upgrade when you need deeper evidence, fixes, automation or a team." (Use pricing prompt voice: technical, honest, no "supercharge".)
- **Toggle (Radix Switch/ToggleGroup):** Monthly / Annual. Annual savings text is **computed**: `monthlyPrice * 12 - annualPrice` shown as "Save ₹X" or "N months free". Never a hardcoded or deceptive discount.
- **Plan cards:** render from `adaptPlans(config)`. Presentation rule (UI metadata only, not business logic):
  - **Hero row = 3 cards**: the three middle paid plans (today: **Starter · Pro · Team**), with **Pro highlighted** ("Most chosen" ribbon; ember border + sticker shadow; slightly taller). Highlight comes from a `highlighted` flag in config; if absent, fall back to the middle card.
  - **Free** = a full-width slim strip **above** the cards ("Start free: 1 public scan per week · basic checks" → `Start Free Scan`).
  - **Enterprise** = a full-width strip **below** the cards (*Enterprise quote request panel*: "Larger organizations, compliance, SSO-ready identity, custom limits" only what's implemented, → `Talk to Security Team`).
  - If config has exactly 3 plans total, render only the 3-card row (no strips). If it has more than 5, add a "More plans" strip. **Never hardcode the plan count.**
- **Each card shows:** name · one-line persona ("You found issues. Now fix them." for Starter, etc., from config or the copy bank) · price (`Intl.NumberFormat('en-IN', { style: 'currency', currency })`, never a literal `₹499`) · billing note · key limits (apps, scans, members, credits) from entitlements · 5–7 capability lines with Lucide `Check` / `Hourglass` ("Coming soon") · CTA from the hierarchy below.
- **CTA hierarchy (from pricing prompt §25):** Free `Start Free Scan` · Starter `Start with Starter` · Pro `Upgrade to Pro` (`Start with Pro` for signed-out) · Team `Start Team Plan` · Enterprise `Talk to Security Team`. Brand style only on the highlighted card; others are secondary/ghost. Checkout via the existing `POST /api/billing/checkout` with `{ planId, cycle }`. Signed-out users go to login with `returnTo=/pricing?plan=<id>`.
- **Current-plan awareness:** if signed in, mark the current plan "Your plan" and make other CTAs relative ("Upgrade" / "Switch").

### 8.2 Comparison table
*Comparison table* pattern: sticky header, sticky first column, group rows (Scanning · Fixing · Automation · Team · Support). Cells: `Check` (included), a value ("20 / month"), `Minus` (not included), or `Hourglass` + "Coming soon". Rows generated from the entitlements config keys; labels from a display-name map with fallback to a humanized key. Mobile: horizontally scrollable with `data-lenis-prevent`.

### 8.3 Credit explanation
Short explainer + a table/cards from `credits` config: Quick scan 0 · Deep scan 2 · API scan 4 · Authenticated scan 5 · AI analysis 6 (**values read from config, not typed**). Rows for operations that are not implemented show **Coming soon**. Add: "Failed scans don't silently use your full credits. Every credit use is logged and visible in your usage history." Only keep a sentence if the pricing implementation really does that; if unsure, remove it and report.

### 8.4 Security capability matrix
Rows = real capabilities (see Appendix A), columns = plans. Use Lucide status icons plus text for accessibility (never color-only).

### 8.5 FAQ and final CTA
*Billing FAQ with plan recap*: left sticky mini-summary of the selected plan, right accordion. Questions: What counts as a scan? What is a credit? What happens if I downgrade? (use the pricing prompt's own wording: existing apps stay available, you just can't add new ones past the limit) · Can I cancel? · What do I keep on the Free plan? · Is annual billing refundable? (**only answer what the billing system actually does; otherwise omit**). Final CTA: *Trial CTA with reassurance* with real reassurances only.

### 8.6 Analytics hooks (if an analytics util exists)
Fire `pricing_viewed`, `plan_selected`, `checkout_started`, `upgrade_prompt_shown/clicked`, `limit_reached` per the pricing prompt (§22). No PII. If no analytics util exists, add typed no-op `track()` calls and report it.

---

## 9. CONTEXTUAL UPGRADE UX (replaces generic "Upgrade to Pro")

Build `UpgradeNudge` (inline card), `UpgradeDialog` (modal) and `UsageMeter` (progress). Follow pricing prompt §13: every prompt answers **1) what you tried, 2) why it's unavailable, 3) which plan unlocks it, 4) what you get.**

Props: `{ attempted, reason, requiredPlanId, benefit, secondaryHref?, severity: 'soft' | 'blocked' }`.

Examples to implement (copy from the pricing prompt where it exists):
- Blocked feature: "Authenticated scanning requires Pro. Your current scan checks publicly accessible security signals. Upgrade to Pro to analyze authenticated application areas." *(Only if that capability is actually enabled. Otherwise show a Coming soon note, not an upgrade.)*
- Limit reached: "You've used all 20 Starter quick scans for this month. Your scan history remains available. [Upgrade Plan]"
- Seat limit (*Seat limit collaboration nudge*): on Team page when members hit the limit.
- Unverified target + active scan attempt: not an upgrade, but a **verification** nudge ("Active scans unlock after you verify ownership").
- Downgrade explainer on Billing: "You currently have 7 applications. Your new plan supports 3. Your existing applications will remain available, but you can't add new ones until you're within the plan limit."

**Wiring:** find how the backend signals limits/entitlement denial (status code and error code in `src/core/billing` and the API routes). Create `adaptEntitlementError()` to convert that into `UpgradeNudge` props. If the backend gives only a bare 403/429, derive text from the request context plus `adaptPlans()`. **Do not change the backend.** Show `UsageMeter` at 80% and 100% of any quota with a soft/blocked state. Never show more than one nudge per screen.

---

## 10. TRUTHFUL COPY BANK (use or adapt; never claim beyond Appendix A)

- Scanner: "14 deterministic check engines. If we report it, we captured the proof."
- Ownership: "No active probes until you prove the site is yours."
- SSRF: "The scanner can't be tricked into hitting internal networks: private IPs, cloud metadata and DNS rebinding are blocked."
- Fixes: "Exact before/after code for Next.js, Express and Nginx. Then re-test just that one check."
- CI: "Fail the build on critical findings. SARIF for GitHub Code Scanning. A summary comment on every PR."
- Audit: "A tamper-evident log of every scan, fix and role change. Export as CSV or SIEM JSON."
- Redaction: "Passwords, tokens, card numbers and auth headers are masked before we store evidence."
- Pricing tagline: "ZERIVEX doesn't sell more scans. It sells more confidence."
- **Avoid:** "Unlock the power of AI", "Supercharge", "military-grade", "100% secure", "cryptographically verified subsystems", any invented numbers, logos or testimonials.

---

## 11. ACCESSIBILITY, PERFORMANCE & MOTION CHECKLIST

- [ ] One H1 per page; landmarks (`header`, `main`, `nav`, `footer`); skip link
- [ ] Contrast: ink-on-ember buttons, `--ds-text-secondary` on paper, chips on tinted bg all at least 4.5:1 (check with the browser devtools)
- [ ] Focus ring visible on every interactive element, including inside ink islands
- [ ] Severity and status never conveyed by color alone (icon + text)
- [ ] All icon-only buttons have `aria-label`; decorative icons `aria-hidden`
- [ ] Radix dialogs/menus keep focus trap + Esc; `cmdk` palette keyboard-navigable
- [ ] `prefers-reduced-motion`: Lenis off, marquee stopped, GSAP skipped, content visible
- [ ] No layout shift from fonts (`next/font`), images (explicit sizes), skeletons
- [ ] Marketing pages fully usable with JS-disabled content (text present in HTML)
- [ ] 320 px width: no horizontal page scroll; tables scroll inside containers
- [ ] No `localStorage`/`window` access during render anywhere (hydration-safe)

---

## 12. PHASED EXECUTION PLAN

**Phase 0: Recon and clean-up**
`ls`, read `package.json` scripts, `src/styles`, `src/components`, `src/adapters`, billing/pricing config, `src/app` layouts. Open the "3 Issues" overlay and fix every error. Remove ThemeToggle + theme-init script. *Check:* dev badge shows 0 issues; tests green. *Report:* the real plan config (3 or 5 plans), how entitlement errors surface, the real test/lint/typecheck commands.

**Phase 1: Foundation**
Tokens (`tokens.css`), fonts, `lucide-react`, Radix + cmdk + sonner + vaul, `ui/` kit, `SmoothScroll` (marketing layout only), GSAP util, rename `*Semrush*` components and files. Replace all emoji/glyphs with Lucide. *Check:* build passes; storybook-style `/dev/ui` page (dev-only, not linked) shows every `ui/` component in all states.

**Phase 2: Global chrome**
AnnouncementBar, Header (pill + mega + mobile drawer), Footer, status pill, toasts. *Check:* keyboard + mobile pass; one Brand button per viewport rule.

**Phase 3: Landing page**
Sections in 7.2 order with hero, sticky story, bento, before/after, CI band, stats, academy preview, FAQ, final CTA. Hero URL flow + Targets `?new=` handling. *Check:* Lighthouse mobile performance 85+, a11y 95+; no fabricated claims left (grep for testimonial/“94%”).

**Phase 4: Pricing**
`adaptPlans()`, `/pricing` page (8.1–8.5), checkout wiring, current-plan awareness. *Check:* change a price/limit in config only, confirm the UI updates with no JSX edits; Coming soon items render correctly.

**Phase 5: Academy + Login**
Hub, article page, login split screen.

**Phase 6: Dashboard restyle + UX layers**
Shell, ⌘K palette, first-run checklist, all pages in 7.9, `UpgradeNudge` + `UsageMeter` wired via `adaptEntitlementError()`.

**Phase 7: Polish and QA**
Run *impeccable* critique/polish on landing, pricing, dashboard overview and findings. Run the full checklist in Section 11. Run tests/lint/typecheck. Final report with before/after screenshots at 1440 px and 390 px.

---

## 13. DEFINITION OF DONE

- [ ] Zero backend/API/migration changes (`git diff --stat` shows only frontend paths)
- [ ] 269 tests (or current count) pass; lint and typecheck clean; dev overlay shows 0 issues
- [ ] No theme toggle; single light "Ember & Paper" theme; no hydration warnings
- [ ] No emoji or text-glyph icons remain (grep clean, except `⌘` and `₹`)
- [ ] Lenis active on marketing routes only; reduced-motion respected; no scroll trapping in modals/code blocks
- [ ] `/pricing` exists, renders from config, highlights Pro (or the configured plan), shows Coming soon honestly
- [ ] Every number, plan, price, limit and credit cost comes from config/catalog/API via adapters
- [ ] Upgrade prompts are contextual and truthful
- [ ] No fabricated testimonials, counts, logos or capabilities anywhere
- [ ] Brand button appears once per viewport; AA contrast verified
- [ ] Every table/card has loading, empty and error states
- [ ] Final report lists any deviations and open questions

---

## APPENDIX A: CAPABILITY TRUTH TABLE (from the architecture spec)

**Implemented (safe to show as working):** TLS/HTTPS checks · security headers · CORS · cookie flags · `security.txt` (RFC 9116) · exposed secrets in client bundles · dangerous HTTP methods · stack-trace leaks · API exposure checks (GraphQL introspection, Swagger) · AI code-smell checks · SQLi, XSS, path traversal, open redirect (active, ownership-verified only) · ownership verification (DNS TXT, HTTP header, HTML meta, file upload) · SSRF egress firewall · 31+ rule remediation catalog with Next.js/Express/Nginx diffs · targeted "Verify Fix Now" · attack surface crawl + technology fingerprints · scheduled scans + score-regression alerts · CI/CD quality gates + SARIF v2.1.0 + PR summary · API keys (`zx_live_*`) · webhooks (HMAC SHA-256) · tamper-evident audit vault + CSV/SIEM JSON export · 5-tier RBAC · team invitations · agency portfolio + white-label branding · Security Academy (10 guides, 4 tracks) · Stripe checkout and customer portal · usage quotas (targets, scans, members).

**Not evidenced in the spec: show as "Coming soon" unless the entitlement config says `enabled` AND the code exists:** authenticated scanning · repository analysis · dependency analysis · AI-assisted vulnerability analysis · credit-weighted "API scan" / "AI analysis" operations · SSO / SAML · dedicated support / SLA · custom contracts · usage-based add-ons or credit packs. *(Quick vs deep scan: the spec has PUBLIC_PASSIVE and VERIFIED_ACTIVE modes; confirm how the pricing config maps "quick" and "deep" onto them before labeling.)*

**Rule:** if unsure, mark Coming soon and list it in your report. Never the other way around.
