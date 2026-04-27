# AYSO Region 13 — Brand Colors

Defined in `site/tailwind.config.js`. Used as Tailwind utility classes (`bg-{name}`, `text-{name}`, `border-{name}`, etc.) throughout the site.

## Palette

| Tailwind name       | Hex       | RGB              | Where it's used |
|---------------------|-----------|------------------|-----------------|
| `brand-red`         | `#f74b4b` | `247, 75, 75`    | Coral accent — hero "SOCCER" text overlay, two-tone underline strips on home tiles, button accent strips, "I'm a soccer..." panel border |
| `brand-red-dark`    | `#83312d` | `131, 49, 45`    | Burgundy — primary text emphasis (headings, links, "LET'S PLAY", nav active states), tile body alternation, hero buttons |
| `brand-maroon`      | `#8e2929` | `142, 41, 41`    | Structural frames — home page quick-action bar, interior page sidebar header, About section role panel, body link hover |
| `brand-maroon-dark` | `#3a0d12` | `58, 13, 18`     | Photo gallery strip background |
| `brand-header`      | `#230511` | `35, 5, 17`      | Very dark maroon — inLeague pill button background, legacy footer reference |
| `brand-cream`       | `#ede8e2` | `237, 232, 226`  | Warm off-white — home Let's Play section background, interior page header strip, sidebar hover/active background |
| `brand-green`       | `#a6ce57` | `166, 206, 87`   | Field status "Open" bar |
| `brand-green-dark`  | `#007a32` | `0, 122, 50`     | Reserved (not currently used on home) |
| `brand-green-light` | `#00d050` | `0, 208, 80`     | Reserved (not currently used on home) |
| `brand-gold`        | `#f4bd4d` | `244, 189, 77`   | Announcement bar background, field status "Monitoring" bar |
| `brand-dark`        | `#221f1f` | `34, 31, 31`     | Body text, nav text on light backgrounds, About heading, footer background |

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

| Foreground          | Background             | Ratio   | AA normal text? |
|---------------------|------------------------|---------|-----------------|
| white               | `brand-red` (#f74b4b)   | ~3.4:1  | ❌ — large text only |
| white               | `brand-red-dark` (#83312d) | ~8.6:1 | ✅ AAA |
| white               | `brand-maroon` (#8e2929) | ~7.6:1 | ✅ AAA |
| `brand-red-dark`    | `brand-cream` (#ede8e2) | ~6.9:1  | ✅ |
| `brand-maroon`      | `brand-cream`           | ~6.4:1  | ✅ |
| `brand-dark`        | `brand-cream`           | ~13:1   | ✅ AAA |
| `brand-dark`        | `brand-green` (#a6ce57) | ~9.5:1  | ✅ AAA |
| `brand-dark`        | `brand-gold` (#f4bd4d)  | ~9.7:1  | ✅ AAA |

**Rule of thumb**: `brand-red` (#f74b4b) is bright/coral — white text on it fails AA, so keep it for accent strips and decorative use, never under body text. Use `brand-red-dark` (burgundy) for any text-bearing red background or for red text on light backgrounds.
