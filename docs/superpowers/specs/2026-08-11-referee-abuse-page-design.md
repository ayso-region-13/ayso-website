# Referee Abuse Prevention Program page — design

Date: 2026-08-11
Status: approved

## Problem

AYSO National adopted U.S. Soccer's Referee Abuse Prevention (RAP) standards into
National Policy 2.E.e effective 2025-03-01. Area 1C approved its implementation
protocols on 2026-07-06 and enforces them across all nine regions starting Fall
2026. Region 13 has no page describing the program, and referees have no
published instruction on what to do when abuse happens or where to report it.

Four governing documents exist but live only on the AYSO national CDN, under
filenames with spaces and version dates that are unusable as public links.

## Decisions

| Question | Decision |
|---|---|
| URL | `/referees/abuse/`, matching the existing plural section |
| Short slugs | `/rapp` and `/referee-abuse`, both with and without trailing slash |
| Audience | Referee-facing, with a short section stating the standard for everyone |
| Depth | Summarize the abuse levels and the reporting path on-page; link PDFs for full detail |
| 2022 Respect the Referee PDF | Keep. It is **not** superseded (see below) |
| Contact routing | `referee@ayso13.org`, not a named RRA |
| Coaches and parents | Cross-link from `/coaches/` and `/parents/` |

### The 2022 PDF is not superseded

`/assets/docs/respect-the-referee.pdf` is a four-page **Region 13** policy: zero
tolerance, coach accountability for their own sideline, the Law 5 "referee
decides the facts" principle, and how to route referee-performance concerns.
*Respecting Our Referees* (v6-1-2026) is a two-page AYSO/USSF standards summary
defining abuse levels and pointing at the U.S. Soccer Penalties Matrix. They
cover different ground. Both are listed, each labeled with its date and scope.

### Dissent and abuse are two tracks, not one escalation

The single most important content decision. Area 1C's protocols are explicit
that RAPP violations are distinct from common dissent, which "will continue to
be addressed by way of warnings, Cautions and/or Send-Offs of players and
coaches, and ejections of spectators." RAPP applies only to language or behavior
that is "extreme and deliberate" and that "causes significant harm" or
"demonstrates a material lack of respect."

Collapsing the two would produce either over-reporting of ordinary sideline
grumbling or under-reporting of real abuse. The page keeps them adjacent but
clearly separated: the on-field dissent ladder is one section, the RAPP
reporting path is another.

## Page structure

```
H1  Referee Abuse Prevention Program
    Why this exists; abuse is a top-two reason officials leave the sport
H2  What we expect from everyone          non-referee audience, short
H2  What counts as referee abuse          4 verbal levels, 3 physical levels
H2  Dissent: warn, caution, dismiss       the on-field ladder
H2  When to send off or eject immediately
H2  Report it                             RRA path + the two Typeforms
H2  Documents                             the four new PDFs + the 2022 policy
H2  Contact
H2  Related Pages
```

## Files touched

**New**
- `site/src/referees/abuse.md`
- `site/src/assets/docs/respecting-our-referees-2026.pdf`
- `site/src/assets/docs/area-1c-rapp-implementation-protocols-2026.pdf`
- `site/src/assets/docs/area-1c-rapp-flow-chart-2026.pdf`
- `site/src/assets/docs/ussf-referee-abuse-prevention-policy-531-9.pdf`

**Modified**
- `site/src/_data/navigation.js` — sidebar entry after Laws of the Game
- `site/src/_redirects` — four new rules (`/rapp`, `/referee-abuse`, ± slash)
- `site/src/referees/index.md` — Related Pages
- `site/src/referees/resources.md` — Document Library section
- `site/src/contact/feedback.md` — point the incident form at the program
- `site/src/about/policies.md` — alongside the existing Respect the Referee text
- `site/src/coaches/index.md` — pointer
- `site/src/parents/index.md` — pointer
- `site/src/llms.njk` — index entry

The redirects Worker goes from 648 to 652 rules and needs its own deploy
(`deploy-redirects-worker.yml`). Source of truth is `site/src/_redirects`;
`workers/redirects/src/map.js` is generated and must not be hand-edited.

No `.pages.yml` change: the `referees` collection globs the whole directory, so
the new page is CMS-editable on creation.

## PDF renaming

| New filename | Source |
|---|---|
| `respecting-our-referees-2026.pdf` | `respecting_our_referees_6-1-2026.pdf` |
| `area-1c-rapp-implementation-protocols-2026.pdf` | `area 1c rapp implementation protocols approved 2026-07-06.pdf` |
| `area-1c-rapp-flow-chart-2026.pdf` | `area 1c rapp flow chart approved 2026-07-06.pdf` |
| `ussf-referee-abuse-prevention-policy-531-9.pdf` | `ussf rap policy 531-9 2026-05-15.pdf` |

Year retained on the three Area 1C revises annually. The USSF policy is
identified by its number, so no date is needed in the filename.

## Out of scope

- Naming Region 13's RRA or the Area 1C RAPP Administrator on the page. All
  contact routes through `referee@ayso13.org`, which survives role turnover.
- Reproducing the U.S. Soccer Penalties Matrix. It is amendable at any time by
  U.S. Soccer's Technical Development Committee; the page links to
  `ussoccer.com/rap` instead.
- Any change to the Typeform forms themselves.
