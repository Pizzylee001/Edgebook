---
name: Edgebook
surface_mode: Operate
theme: dark
version: final
tokens:
  color:
    bg: "#090B0F"
    surface: "#0F131A"
    raised: "#151B24"
    hairline: "#232B36"
    hairlineSoft: "#18202A"
    text: "#E6EBF2"
    textMuted: "#93A0B0"
    textFaint: "#63707F"
    accent: "#7FD6E6"
    accentInk: "#06181A"
    accentSoft: "rgba(127,214,230,0.12)"
    market: "#8593A3"
    positive: "#4ED0A0"
    negative: "#F0766B"
    ring: "#7FD6E6"
  fontFamily:
    display: Barlow Condensed
    body: Barlow
    data: IBM Plex Mono
  radius: controls 8px, blocks 12px, chips 999px
  spacing: 4px base scale
  density: 8
---

# Edgebook DESIGN.md, final

## 1. Visual Theme and Atmosphere

A call ledger for prediction markets, set as a cool instrument on a dark field. The Design Read line: "Reading this as: an Operate surface for active Polymarket forecasters, with a precise instrument-and-record language on a cold dark field, leaning toward Dimensional Layering with an ice-cyan accent."

The app keeps two planes visibly separate: the market's implied probability and your stated probability. That split is the product, so the surface shows the two meeting. Punch comes from structure, one ice accent, and one owned number, the Edge dial.

Background treatment (documented job): a dark void over a faint 44px measurement grid, masked to a radial focus, with a slow low-opacity cell flicker and a radial backlight behind the calibration curve. The grid is the measuring field the calls are plotted on. Flicker is capped, disabled under reduced motion, and never brighter than 10 percent. No pure #000000 and no pure #FFFFFF.

## 2. Color Palette and Roles

| Token | Hex | Role |
|---|---|---|
| bg | #090B0F | Page ground, cold near-black |
| surface | #0F131A | Panels, tiles, table shell |
| raised | #151B24 | Inputs, inset fills, hover rows |
| hairline | #232B36 | 1px structural rules and borders |
| hairlineSoft | #18202A | Inner row dividers and grid lines |
| text | #E6EBF2 | Primary ink, cool off-white |
| textMuted | #93A0B0 | Secondary and captions |
| textFaint | #63707F | Stamps, axis labels, sample tags |
| accent | #7FD6E6 | Your call, your edge, focus, primary action, dial ring |
| accentInk | #06181A | Text on ice fills |
| accentSoft | rgba(127,214,230,0.12) | Selected nav and active states |
| market | #8593A3 | The market series, neutral so your call reads as the bright plane |
| positive | #4ED0A0 | Edge and settlement up only |
| negative | #F0766B | Edge down and settlement loss only |
| ring | #7FD6E6 | Focus visible |

Rules: one accent (ice-cyan), one neutral market color, green and red for data direction only. The accent is deliberately not a blue-violet, to avoid the generic trading-app default. Ice text on bg above 4.5:1; muted text above 4.5:1; primary button ice fill with near-black label above 4.5:1. Green and red never carry meaning alone; each always sits with a written result.

## 3. Typography Rules

Barlow Condensed for display headings, uppercase, the scoreboard voice. Barlow for body, labels, and controls. IBM Plex Mono for every number, timestamp, probability, and stamp, tabular figures. Mono is used for measurement only.

| Role | Font | Size / weight | Notes |
|---|---|---|---|
| Page title | Barlow Condensed | clamp(30px,4vw,46px) / 700 | Uppercase, tracking 0.02em |
| Section head | Barlow Condensed | 22px / 600 | Uppercase |
| Caption head | Barlow | 13px / 500 | Uppercase, letterspaced 0.1em |
| Body | Barlow | 15.5px / 400, 1.6 | Measure 60 to 72ch |
| Label / button | Barlow | 14px / 600 | Buttons sentence case |
| Data | IBM Plex Mono | 13 to 14px / 400 | tabular-nums everywhere |
| Fact value | IBM Plex Mono | 24px / 600 | Live-fact strip numbers |
| Stamp | IBM Plex Mono | 11px / 500 | Uppercase source tags |

Production load line: next/font/google, Barlow_Condensed weights 600 700, Barlow weights 400 500 600, IBM_Plex_Mono weights 400 500 600, subsets latin, display swap.

## 4. Component Stylings

- Side rail (N3): 248px, sticky, hairline right border. Wordmark "EDGEBOOK." in Barlow Condensed, a mono footer line carrying the required "Powered by Nansen API". Collapses to a bottom bar under 768px.
- Nav item: muted at rest, accent-soft background and ice fee text when current, hover raises to text color. aria-current on the active route.
- Live-fact strip: a three-cell strip above the markets table (biggest 24h move, your open calls, hot category), 1px hairline gaps, mono values. This is the first-screen substance on the discover route.
- Edge dial: the signature. A circular ring (SVG, r=65, stroke 11) whose fill is set by a --fill custom property to match the number it shows, animating on entry. Small on the market detail and call form, full size on the Edge report.
- Category chip: pill, hairline border, aria-pressed toggles to ice fill, 8px gaps.
- Data table: hairline shell, 12px radius, no shadow. Uppercase mono column heads in faint, rows separated by hairlineSoft, row hover to surface. Probabilities and volumes right-aligned, tabular.
- Input: raised fill, hairline border, 8px radius, label above, helper below. Focus shows the ice ring. Loading disables and changes the written label.
- Primary button: ice fill, near-black label, 8px radius. Secondary: hairline outline on transparent. Link button: ice text, underline on hover.
- Calibration chart: inline SVG, ice polyline against a dashed ideal diagonal, neutral observed points, mono axis labels, with a text summary for screen readers.
- States, all real: empty (cause plus next action, same chrome), loading (skeleton rows), populated, error (cause plus retry, and a note that saved calls are safe).

## 5. Layout Principles

Four screens: /markets (discover), /market/[id] (detail and Log a Call), /journal (calls and status), /profile (calibration and edge report). Discover opens with the live-fact strip, then a dense table. Detail is a two-column asymmetric grid (1.35fr and 1fr): chart and snapshot left, the Log a Call form with the dial right. Journal is a dense single-column table. Edge is a two-column grid: calibration chart left, a stacked dial, scorecard, and edge-by-category right. Pinned heading at the top of each view with a hairline under it. Container max 1200px. Spacing scale 4/8/12/16/24/32/48; 22px grid gaps, 32px between zones. Below 900px the two-column grids stack and the fact strip becomes one column. Below 768px the rail becomes a bottom bar, and the traders column drops.

## 6. Depth and Elevation

Layered, not shadowed. Depth comes from three surface tones (bg, surface, raised), 1px hairlines, and the radial backlight behind the calibration curve. No drop shadows. The brightest objects are the ice dial, the primary button, and the ice nav state.

## 7. Do's and Don'ts

Do: uppercase Barlow Condensed headings, mono for every number and stamp, tabular figures, the neutral market series always subordinate to the ice call series, the dial fill always matching its number, real timestamps, focus rings, SAMPLE labels on every preview number, Nansen attribution on every prediction-market surface.

Do not (Analytics Dashboard product-entry anti-patterns, verbatim): Ornate design, No filtering. Also do not: a blue-violet trading accent, gradients, glass panels, glow, drop shadows, card grids of equal icon panels, eyebrows above headings, emoji icons, invented numbers, pure #000000 or #FFFFFF, more than one accent.

## 8. Responsive Behavior

Breakpoints 375 / 768 / 900 / 1024 / 1440. Rail collapses to a bottom bar under 768px, main content reserves 104px bottom padding. Two-column grids and the fact strip stack under 900px. Table drops the traders column under 768px and keeps market, implied, call, and status. Touch targets 44px minimum. Dial and charts are SVG and scale with their container. All motion, including the dial fill and the grid flicker, is disabled under prefers-reduced-motion with the final readable state shown.

## 9. Signature, Motion and Depth

Signature: the Edge dial, a circular gauge that fills to your edge versus the market and to your stated probability on the call form. The ring fill is computed from the value via a --fill custom property so the graphic never contradicts the number. It is the one memorable object in the product and encodes the idea a viewer keeps: your edge, as a number only the journal can produce.

Motion tier: Subtle. View entrance is a 220ms fade-up. Hover is border and surface shifts at 160ms. The dial fills once at 900ms on entry and on commit. The grid cell flicker is ambient, low, and off under reduced motion. No scroll reveals, no parallax, no stagger on content.

Depth: layered surfaces with hairlines, plus the radial backlight behind the calibration curve. No shadow system.
