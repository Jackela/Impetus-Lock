# Impetus Lock — Design System

> Inspired by ElevenLabs: Dark Cinematic UI, Audio-Waveform Aesthetics

This file defines the visual design language for Impetus Lock. It follows the [DESIGN.md format](https://stitch.withgoogle.com/docs/design-md/overview/) so AI coding agents can generate UI that matches this design system.

---

## 1. Visual Theme & Atmosphere

**Core Philosophy:** Cinema-black canvas with surgical precision. Every element earns its place. The interface disappears into the writing experience — until the AI strikes.

- **Mood:** Dark, cinematic, high-stakes. Like a recording studio at 2AM.
- **Density:** Low density. Generous whitespace. Content breathes.
- **Design Philosophy:** Radical subtraction. If it doesn't serve the writing, it doesn't exist.
- **Motion:** Purposeful and restrained. Animations communicate AI intervention — never decorative.
- **Audio Aesthetic:** Waveform motifs reference the app's audio feedback system (clank, bonk, whoosh).
- **Roguelike Tension:** The interface should feel like a game — quiet anticipation, sudden disruption.

---

## 2. Color Palette & Roles

### Core Surfaces

| Token                  | Hex                   | Role                             |
| ---------------------- | --------------------- | -------------------------------- |
| `--color-bg-primary`   | `#0A0A0A`             | App background. Near-pure black. |
| `--color-bg-secondary` | `#111111`             | Header, sidebar backgrounds      |
| `--color-bg-elevated`  | `#1A1A1A`             | Cards, modals, editor surface    |
| `--color-bg-sunken`    | `#080808`             | Input backgrounds, code blocks   |
| `--color-bg-overlay`   | `rgba(0, 0, 0, 0.85)` | Modal backdrops                  |

### Text

| Token                    | Hex       | Role                              |
| ------------------------ | --------- | --------------------------------- |
| `--color-text-primary`   | `#FAFAFA` | Body text, headings               |
| `--color-text-secondary` | `#A1A1AA` | Metadata, labels, muted info      |
| `--color-text-muted`     | `#52525B` | Placeholder text, disabled states |
| `--color-text-inverted`  | `#0A0A0A` | Text on light/accent backgrounds  |

### Borders & Dividers

| Token                   | Hex                         | Role                          |
| ----------------------- | --------------------------- | ----------------------------- |
| `--color-border`        | `rgba(255, 255, 255, 0.08)` | Subtle dividers, card borders |
| `--color-border-strong` | `rgba(255, 255, 255, 0.15)` | Interactive element borders   |
| `--color-border-focus`  | `#22C55E`                   | Focus rings, active states    |

### Semantic / Interactive

| Token                 | Hex                       | Role                                                                        |
| --------------------- | ------------------------- | --------------------------------------------------------------------------- |
| `--color-accent`      | `#22C55E`                 | Primary accent. "Connected/Active" green. Used for CTAs, active indicators. |
| `--color-accent-dim`  | `rgba(34, 197, 94, 0.15)` | Subtle green tint backgrounds                                               |
| `--color-accent-glow` | `rgba(34, 197, 94, 0.4)`  | Green glow for shadow effects                                               |
| `--color-danger`      | `#EF4444`                 | Errors, destructive actions, Loki mode                                      |
| `--color-danger-dim`  | `rgba(239, 68, 68, 0.15)` | Loki background tint                                                        |
| `--color-warning`     | `#F59E0B`                 | Warnings, intermediate states                                               |
| `--color-info`        | `#3B82F6`                 | Informational states                                                        |

### Agent-Specific Palette

| Token                     | Hex                        | Role                               |
| ------------------------- | -------------------------- | ---------------------------------- |
| `--color-muse-accent`     | `#22C55E`                  | Muse mode — green "inspiration"    |
| `--color-muse-border`     | `rgba(34, 197, 94, 0.5)`   | Muse locked content border         |
| `--color-muse-background` | `rgba(34, 197, 94, 0.08)`  | Muse locked content surface        |
| `--color-loki-accent`     | `#EF4444`                  | Loki mode — red "chaos"            |
| `--color-loki-border`     | `rgba(239, 68, 68, 0.5)`   | Loki locked content border         |
| `--color-loki-background` | `rgba(239, 68, 68, 0.08)`  | Loki locked content surface        |
| `--color-lock-accent`     | `#F59E0B`                  | Lock indicator — amber "immutable" |
| `--color-lock-border`     | `rgba(245, 158, 11, 0.5)`  | Lock border                        |
| `--color-lock-background` | `rgba(245, 158, 11, 0.06)` | Lock background surface            |

---

## 3. Typography Rules

### Font Stack

```css
--font-sans: "Inter", "SF Pro Display", system-ui, -apple-system, sans-serif;
--font-mono: "JetBrains Mono", "Fira Code", "Cascadia Code", monospace;
```

### Scale

| Token            | Size | Weight  | Line Height | Usage                        |
| ---------------- | ---- | ------- | ----------- | ---------------------------- |
| `--text-xs`      | 11px | 400     | 1.4         | Badges, timestamps, metadata |
| `--text-sm`      | 13px | 400/500 | 1.5         | Labels, captions, nav items  |
| `--text-base`    | 15px | 400     | 1.6         | Body copy, paragraphs        |
| `--text-lg`      | 17px | 500     | 1.6         | Section intros, lead text    |
| `--text-xl`      | 20px | 600     | 1.4         | Component headings           |
| `--text-2xl`     | 24px | 700     | 1.3         | Modal titles                 |
| `--text-3xl`     | 30px | 700     | 1.2         | Page headings                |
| `--text-display` | 38px | 800     | 1.1         | Hero/brand moments           |

### Typography Rules

- Never use font-weight below 400 for body text
- Headings use 600–800 weight
- Letter-spacing: `-0.02em` for display sizes, `0` for body
- Never exceed 72ch line length in the editor
- Use `font-variant-numeric: tabular-nums` for counters/timers

---

## 4. Component Stylings

### Buttons

**Primary Button** (CTA — e.g., "I'm Stuck!")

```css
background: #22c55e;
color: #0a0a0a;
border: none;
border-radius: 6px;
padding: 10px 20px;
font-size: 13px;
font-weight: 600;
letter-spacing: 0.01em;
transition: all 0.15s ease;
/* Hover */
background: #16a34a;
box-shadow: 0 0 20px rgba(34, 197, 94, 0.35);
```

**Secondary Button** (e.g., "Lock Session")

```css
background: transparent;
color: #a1a1aa;
border: 1px solid rgba(255, 255, 255, 0.12);
border-radius: 6px;
padding: 8px 16px;
font-size: 13px;
font-weight: 500;
/* Hover */
border-color: rgba(255, 255, 255, 0.25);
color: #fafafa;
```

**Ghost Button** (icon buttons, toggles)

```css
background: transparent;
border: none;
color: #52525b;
border-radius: 6px;
padding: 8px;
/* Hover */
background: rgba(255, 255, 255, 0.06);
color: #a1a1aa;
/* Active */
background: rgba(34, 197, 94, 0.1);
color: #22c55e;
border: 1px solid rgba(34, 197, 34, 0.3);
```

### Mode Selector (Dropdown)

```css
background: #111111;
color: #fafafa;
border: 1px solid rgba(255, 255, 255, 0.12);
border-radius: 6px;
padding: 8px 32px 8px 12px;
font-size: 13px;
/* Focused */
border-color: #22c55e;
outline: none;
box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2);
```

### Cards / Panels

```css
background: #1a1a1a;
border: 1px solid rgba(255, 255, 255, 0.08);
border-radius: 8px;
padding: 16px;
/* Hover */
border-color: rgba(255, 255, 255, 0.15);
```

### Inputs / Text Areas

```css
background: #111111;
border: 1px solid rgba(255, 255, 255, 0.1);
border-radius: 6px;
color: #fafafa;
font-size: 14px;
padding: 10px 14px;
caret-color: #22c55e;
/* Focus */
border-color: rgba(34, 197, 94, 0.5);
box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.15);
/* Placeholder */
color: #52525b;
```

### Modal / Dialog

```css
background: #111111;
border: 1px solid rgba(255, 255, 255, 0.1);
border-radius: 12px;
box-shadow: 0 24px 64px rgba(0, 0, 0, 0.8);
padding: 32px;
/* Backdrop */
background: rgba(0, 0, 0, 0.85);
backdrop-filter: blur(8px);
```

### Header / Navigation Bar

```css
background: rgba(10, 10, 10, 0.95);
border-bottom: 1px solid rgba(255, 255, 255, 0.06);
backdrop-filter: blur(12px);
height: 56px;
padding: 0 24px;
```

### Sidebar / Task List

```css
background: #0f0f0f;
border-right: 1px solid rgba(255, 255, 255, 0.06);
width: 280px;
```

### Editor Surface (Milkdown)

```css
background: transparent;
max-width: 720px;
padding: 48px 32px;
/* Paragraphs */
color: #e4e4e7;
font-size: 17px;
line-height: 1.8;
/* Headings */
color: #fafafa;
/* Caret */
caret-color: #22c55e;
```

### Waveform Decoration

Audio-waveform motifs as decorative elements (CSS or SVG):

```
Mini waveform bars: 5–9 vertical bars of varying heights
Colors: rgba(34, 197, 94, 0.3) static, rgba(34, 197, 94, 0.7) on active mode
Heights: [40%, 70%, 100%, 80%, 55%, 90%, 65%, 45%, 75%]
Gap between bars: 3px
Bar width: 3px
Border-radius: 2px on all bars
Animation: subtle pulse on active AI mode
```

### Toast Notifications

```css
background: #1a1a1a;
border: 1px solid rgba(255, 255, 255, 0.1);
border-radius: 8px;
box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
color: #fafafa;
font-size: 13px;
padding: 12px 16px;
/* Success */
border-left: 3px solid #22c55e;
/* Error */
border-left: 3px solid #ef4444;
```

### Badges / Tags

```css
background: rgba(34, 197, 94, 0.12);
color: #22c55e;
border: 1px solid rgba(34, 197, 94, 0.25);
border-radius: 4px;
font-size: 11px;
font-weight: 600;
padding: 2px 8px;
letter-spacing: 0.05em;
text-transform: uppercase;
```

### Locked Content (AI-injected, immutable)

```css
/* Muse locked content: green cinematic highlight */
border-left: 3px solid rgba(34, 197, 94, 0.6);
background: rgba(34, 197, 94, 0.06);
border-radius: 0 6px 6px 0;
/* Loki locked content: red chaos highlight */
border-left: 3px solid rgba(239, 68, 68, 0.6);
background: rgba(239, 68, 68, 0.06);
```

### Timer / Progress Indicator

```css
color: #22c55e;
filter: drop-shadow(0 0 6px rgba(34, 197, 94, 0.5));
```

---

## 5. Layout Principles

### Spacing Scale

```
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px
--space-5: 20px
--space-6: 24px
--space-8: 32px
--space-10: 40px
--space-12: 48px
--space-16: 64px
```

### Grid

- Single-column editor layout with optional left sidebar
- Sidebar: 280px fixed width (collapsible)
- Editor content: max-width 720px, centered
- Header: full-width, fixed height 56px
- Main area: fills viewport height minus header

### Whitespace Philosophy

- Generous internal padding (24–48px in modals)
- Breathe: never crowd elements
- Editor text area: wide margins that collapse on mobile
- Sidebar items: 12px padding per row

---

## 6. Depth & Elevation

### Shadow System

```
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.4)
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.5)
--shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.6)
--shadow-xl: 0 24px 64px rgba(0, 0, 0, 0.8)
--shadow-glow-green: 0 0 20px rgba(34, 197, 94, 0.35)
--shadow-glow-red: 0 0 16px rgba(239, 68, 68, 0.3)
```

### Surface Hierarchy

1. **Deepest** (`#080808`): App background behind everything
2. **Base** (`#0A0A0A`): Primary app canvas
3. **Raised** (`#111111`): Header, sidebar, nav elements
4. **Elevated** (`#1A1A1A`): Cards, modals, dropdowns
5. **Overlay** (rgba(0,0,0,0.85)): Modal backdrops with blur

---

## 7. Do's and Don'ts

### Do

- ✅ Use pure black (#0A0A0A) as the canvas — never true white backgrounds
- ✅ Use green (#22C55E) as the primary accent — it signals "active, alive, AI-aware"
- ✅ Apply glow effects (box-shadow with green rgba) for active states, not all states
- ✅ Use border-left accents (3–4px) to distinguish AI-generated locked content
- ✅ Keep the editor surface clean and distraction-free — it's the hero
- ✅ Use waveform bar decorations to reference the audio feedback system
- ✅ Animate purposefully: shake for rejection, fade for Loki delete, glitch for Muse injection
- ✅ Maintain WCAG AA contrast (4.5:1 for body text on dark backgrounds)
- ✅ Use monospace font for mode labels, lock IDs, technical status indicators

### Don't

- ❌ Never use pure white (#FFFFFF) as a background
- ❌ Never use bright purple as primary accent — this is ElevenLabs-inspired now
- ❌ Never use warm drop shadows — only cold, dark shadows
- ❌ Never use rounded corners above 12px (no pill shapes except specific badge exceptions)
- ❌ Never animate the editor content area itself — only overlays and feedback elements
- ❌ Never use gradients on backgrounds (subtle gradients on buttons/badges only)
- ❌ Never use more than 3 type sizes in a single view
- ❌ Never crowd the editor — it must feel like a distraction-free writing environment

---

## 8. Responsive Behavior

### Breakpoints

```
--bp-mobile: 640px    (phones)
--bp-tablet: 768px    (tablets)
--bp-desktop: 1024px  (standard desktops)
--bp-wide: 1440px     (wide screens)
```

### Rules

- **Mobile (<640px)**: Sidebar hides completely (slide-in overlay), header collapses to icon-only, editor is full-width
- **Tablet (640–1024px)**: Sidebar is toggleable with icon-only nav, editor has 16px horizontal margins
- **Desktop (>1024px)**: Sidebar visible when toggled, editor centered with auto side margins
- **Touch targets**: Minimum 44×44px for all interactive elements (WCAG 2.1)
- **Header**: Adapts from 3-section desktop layout to stacked mobile layout at 768px

---

## 9. Agent Prompt Guide

### Quick Color Reference

```
Black canvas:     #0A0A0A
Dark surface:     #111111
Elevated surface: #1A1A1A
Primary text:     #FAFAFA
Secondary text:   #A1A1AA
Green accent:     #22C55E
Green glow:       rgba(34, 197, 94, 0.4)
Red (Loki/error): #EF4444
Amber (lock):     #F59E0B
Subtle border:    rgba(255, 255, 255, 0.08)
```

### Ready-to-Use Prompts

**"Build me a header"**

> A sticky header on #111111 background with rgba(255,255,255,0.06) bottom border. Left: app name in white 600 weight + icon buttons for toggles. Center/Right: mode selector dropdown + primary CTA button in green (#22C55E). Height 56px. Includes mini waveform decoration (5 animated bars in green) near the app name.

**"Build me a task sidebar"**

> Left panel, 280px wide, #0F0F0F background, rgba(255,255,255,0.06) right border. Task items as rows with hover state rgba(255,255,255,0.04), active item has left accent bar in #22C55E. Section header in 11px uppercase #52525B.

**"Build me a modal"**

> Centered dialog on rgba(0,0,0,0.85) backdrop with backdrop-filter: blur(8px). Modal surface #111111, 1px border rgba(255,255,255,0.1), 12px border-radius, 32px padding. Title in #FAFAFA 24px 700 weight. CTA button green, cancel ghost button.

**"Build me the writing editor"**

> Full-height editor area, #0A0A0A background. Milkdown/ProseMirror content centered at max 720px. Body text #E4E4E7 17px, 1.8 line height. Caret #22C55E. Locked content blocks: Muse = green left border, Loki = red left border. No editor chrome — pure writing surface.
