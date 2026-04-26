# AYSO Region 13 — Brand Colors

Defined in `site/tailwind.config.js`. Used as Tailwind utility classes (`bg-{name}`, `text-{name}`, `border-{name}`, etc.) throughout the site.

## Palette

| Tailwind name       | Hex       | RGB              | Where it's used |
|---------------------|-----------|------------------|-----------------|
| `brand-red`         | `#ff3c3c` | `255, 60, 60`    | Bright accent — hero "SOCCER" text overlay, two-tone underline strips on home tiles, button accent strips |
| `brand-red-dark`    | `#ce0e2d` | `206, 14, 45`    | Logo red — primary text emphasis (headings, links, "LET'S PLAY", nav active states), tile body alternation, hero buttons |
| `brand-maroon`      | `#8e2929` | `142, 41, 41`    | Structural frames — home page quick-action bar, interior page sidebar header, About section role panel, body link hover |
| `brand-maroon-dark` | `#3a0d12` | `58, 13, 18`     | Photo gallery strip background |
| `brand-header`      | `#230612` | `35, 6, 18`      | Very dark maroon — inLeague pill button background, legacy footer reference |
| `brand-cream`       | `#ede5d3` | `237, 229, 211`  | Warm tan — home Let's Play section background, interior page header strip, sidebar hover/active background |
| `brand-green`       | `#a7ce57` | `167, 206, 87`   | Field status "Open" bar |
| `brand-green-dark`  | `#007a32` | `0, 122, 50`     | Reserved (not currently used on home) |
| `brand-green-light` | `#00d050` | `0, 208, 80`     | Reserved (not currently used on home) |
| `brand-gold`        | `#f5bd4e` | `245, 189, 78`   | Announcement bar background, field status "Monitoring" bar |
| `brand-dark`        | `#231f20` | `35, 31, 32`     | Body text, nav text on light backgrounds, About heading, footer background |

## Usage

```html
<!-- Background -->
<div class="bg-brand-cream">…</div>
<div class="bg-brand-red-dark">…</div>

<!-- Text -->
<h2 class="text-brand-red-dark">Heading</h2>
<p class="text-brand-maroon">Description</p>

<!-- Border -->
<div class="border-brand-maroon">…</div>

<!-- With opacity (Tailwind slash syntax) -->
<div class="bg-brand-red-dark/85">85% opaque</div>
<div class="bg-brand-cream/50">50% opaque</div>
```

## Contrast notes (WCAG AA)

| Foreground          | Background          | Ratio  | AA normal text? |
|---------------------|---------------------|--------|-----------------|
| white               | `brand-red` (#ff3c3c) | 3.47:1 | ❌ — large text only |
| white               | `brand-red-dark` (#ce0e2d) | 5.83:1 | ✅ |
| white               | `brand-maroon` (#8e2929) | 7.6:1  | ✅ AAA |
| `brand-red-dark`    | `brand-cream` (#ede5d3) | 4.50:1 | ✅ |
| `brand-maroon`      | `brand-cream`         | 6.4:1  | ✅ |
| `brand-dark`        | `brand-cream`         | 13.7:1 | ✅ AAA |
| `brand-dark`        | `brand-green` (#a7ce57) | 9.5:1  | ✅ AAA |
| `brand-dark`        | `brand-gold` (#f5bd4e) | 9.7:1  | ✅ AAA |

**Rule of thumb**: `brand-red` (#ff3c3c) is bright enough that white text on it fails AA — keep it for accent strips and decorative use, never under body text. Use `brand-red-dark` for any text-bearing red background or for red text on light backgrounds.
