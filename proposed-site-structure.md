# AYSO Region 13 - Proposed Site Structure (Revised v2)

## Executive Summary

The current site has **159 pages**. After thorough content review, this proposal consolidates to approximately **70 pages** with clean menu organization, separate pages for programs and fields, and a comprehensive redirect map.

---

## Current Site Analysis

### What We're Keeping (with reorganization)
- All programs as separate pages (including NEXT, Grad Series, Sunday Soccer)
- All field location pages (reorganized under `/fields/`)
- Detailed referee section (reorganized)
- News/announcements functionality
- Document library
- Photo gallery

### What We're Eliminating
- Year-specific pages (thanksgiving-tournament-2024, age-chart-2023, etc.)
- WordPress placeholder pages (sample-page)
- Duplicate landing pages (pen, fb, lc appear to be duplicates)
- Outdated schedule placeholders (weekly)

---

## Proposed Navigation Structure

```
HOME
│   ├── News & Announcements section
│   ├── Field Status alerts
│   ├── Quick CTAs (Register, Volunteer, Find Team)
│   └── Current season info
│
├── ABOUT ▼
│   ├── Mission & Philosophy
│   ├── History
│   ├── Leadership & Board
│   ├── Policies & Fine Print
│   ├── Diversity & Inclusion
│   ├── Hall of Fame
│   ├── Neighbors (other regions)
│   ├── Sisterhood of Soccer
│   └── Board Minutes
│
├── PROGRAMS ▼
│   ├── Programs Overview
│   ├── Fall Soccer (Core 6U-14U)
│   ├── Upper Division (16U/19U)
│   ├── Preschool (4U/5U)
│   ├── NEXT (advanced play)
│   ├── Winter Stars
│   ├── All-Stars
│   ├── Grad Series
│   ├── Spring Soccer
│   ├── Sunday Soccer
│   ├── EPIC (Inclusion Program)
│   ├── Tournaments ▼
│   │   ├── Thanksgiving Tournament
│   │   ├── Rose City Cup
│   │   └── Spring Classic
│   └── Summer Camps
│
├── REGISTER ▼
│   ├── Player Registration
│   ├── Age Chart & Divisions
│   └── Volunteer Registration
│
├── SCHEDULES ▼
│   ├── Game Schedules
│   ├── Standings
│   ├── Playoffs & Results
│   └── Season Calendar
│
├── FOR PARENTS ▼
│   ├── Getting Started (Play page content)
│   ├── Team Info
│   ├── Equipment & Uniforms
│   ├── Parent Pledge
│   ├── Parent FAQs
│   └── Being a Supportive Parent
│
├── FOR COACHES ▼
│   ├── Coach Overview
│   ├── Getting Started
│   ├── Training & Certification
│   ├── Practice Resources
│   ├── Game Day Guide
│   ├── Game Cards
│   ├── Skills & Drills
│   ├── PIE Philosophy
│   ├── Shootout Guide
│   ├── Tournament Teams
│   ├── Women's Coaching Alliance
│   └── Coach FAQs
│
├── FOR REFEREES ▼
│   ├── Referee Overview
│   ├── Why Referee?
│   ├── Training & Certification
│   ├── Referee Scheduling
│   ├── Laws of the Game
│   ├── Youth Referee Program (PRO)
│   ├── Referee Resources
│   └── Referee FAQs
│
├── FOR TEAM MANAGERS ▼
│   ├── Manager Overview
│   ├── Training Requirements
│   ├── Tasks & Checklists
│   └── Manager Resources
│
├── FOR VOLUNTEERS ▼
│   ├── Volunteer Overview
│   ├── Volunteer Roles
│   ├── Training Classes
│   ├── Field Host (Tent)
│   ├── Board Onboarding
│   ├── Volunteer FAQs
│   └── Sponsors
│
├── FIELDS ▼
│   ├── Field Map (overview)
│   ├── Goal Setup Instructions
│   └── [Individual field pages - see list below]
│
├── RESOURCES ▼
│   ├── Document Library
│   ├── Photo Gallery
│   ├── Forms
│   ├── Safety & Heat Policy
│   ├── Incident Reporting
│   └── Pro Tickets (events)
│
└── CONTACT
    ├── Contact Us
    └── Feedback
```

---

## Page Count Summary

| Section | Pages | Notes |
|---------|-------|-------|
| Home | 1 | With news/announcements section |
| About | 9 | Mission, History, Leadership, Policies, DEI, Hall of Fame, Neighbors, Sisterhood, Minutes |
| Programs | 14 | Overview + 10 programs + 3 tournaments |
| Register | 3 | Player, Age Chart, Volunteer |
| Schedules | 4 | Schedules, Standings, Playoffs, Calendar |
| For Parents | 6 | Getting Started, Team, Equipment, Pledge, FAQs, Support |
| For Coaches | 12 | Overview, Getting Started, Training, Practice, Game Day, Game Cards, Drills, PIE, Shootout, Tournament Teams, WCA, FAQs |
| For Referees | 8 | Overview, Why, Training, Scheduling, Laws, PRO, Resources, FAQs |
| For Team Managers | 4 | Overview, Training, Tasks, Resources |
| For Volunteers | 7 | Overview, Roles, Classes, Tent, Onboarding, FAQs, Sponsors |
| Fields | ~20 | Map, Goals, + individual field pages |
| Resources | 6 | Docs, Gallery, Forms, Safety, Incidents, Tickets |
| Contact | 2 | Contact, Feedback |
| **TOTAL** | **~75** | Down from 159 (53% reduction) |

---

## Complete Page Inventory

### PAGES TO KEEP (Reorganized)

#### Home & Core Pages
| Current URL | New URL | Content |
|-------------|---------|---------|
| `/` | `/` | Homepage with news section |
| `/register/` | `/register` | Player registration |
| `/age/` | `/age-divisions` | Age chart & divisions |
| `/volunteer/` | `/volunteer-signup` | Volunteer registration |

#### About Section
| Current URL | New URL | Content |
|-------------|---------|---------|
| `/mission/` | `/mission` | Mission & philosophy |
| `/philosophies/` | `/mission` | Merge into mission |
| `/history/` | `/history` | Region history |
| `/leadership/` | `/leadership` | Board & leadership |
| `/policy/` | `/policies` | Policies |
| `/fine-print/` | `/policies` | Merge into policies |
| `/privacy-policy/` | `/policies` | Merge into policies |
| `/inclusion/` | `/inclusion` | DEI page |
| `/fame/` | `/hall-of-fame` | Hall of Fame |
| `/neighbors/` | `/neighbors` | Other regions |
| `/sisterhood-of-soccer/` | `/sisterhood` | Women's initiative |
| `/minutes/` | `/minutes` | Board meeting minutes |
| `/celebration-of-womens-soccer/` | `/sisterhood` | Merge into sisterhood |

#### Programs
| Current URL | New URL | Content |
|-------------|---------|---------|
| `/programs/` | `/programs` | Programs overview |
| `/fall/` | `/fall-soccer` | Fall Core program |
| `/upper-division/` | `/upper-division` | High school program |
| `/preschool/` | `/preschool` | 4U/5U programs |
| `/next/` | `/next` | NEXT advanced program |
| `/winter-stars/` | `/winter-stars` | Winter program |
| `/all-stars/` | `/all-stars` | All-Stars program |
| `/grad-series/` | `/grad-series` | 8U→10U transition |
| `/spring/` | `/spring-soccer` | Spring program |
| `/sunday/` | `/sunday-soccer` | Sunday skills program |
| `/epic/` | `/epic` | Inclusion program |
| `/camp/` | `/camps` | Summer camps |
| `/tournament/` | `/tournaments` | Tournaments overview |
| `/thanksgiving-tournament/` | `/thanksgiving-tournament` | Thanksgiving tournament |
| `/rosecity/` | `/rose-city-cup` | Rose City Cup |

#### Schedules
| Current URL | New URL | Content |
|-------------|---------|---------|
| `/schedule/` | `/schedules` | Game schedules |
| `/standings/` | `/standings` | Standings |
| `/fall-playoffs/` | `/playoffs` | Playoffs & results |
| `/results/` | `/playoffs` | Merge into playoffs |
| `/calendar/` | `/calendar` | Season calendar |

#### For Parents
| Current URL | New URL | Content |
|-------------|---------|---------|
| `/play/` | `/parents/getting-started` | Getting started guide |
| `/team/` | `/parents/team` | Team info & resources |
| `/uniform/` | `/parents/equipment` | Equipment guide |
| `/equipment-guide/` | `/parents/equipment` | Merge |
| `/pledge/` | `/parents/pledge` | Parent pledge |
| `/ideas-for-being-a-supportive-ayso-parent/` | `/parents/support` | Supportive parent |

#### For Coaches
| Current URL | New URL | Content |
|-------------|---------|---------|
| `/coach/` | `/coaches` | Coach overview |
| `/coach-training/` | `/coaches/training` | Training |
| `/practice/` | `/coaches/practice` | Practice resources |
| `/coach/game-prep-for-6u-8u/` | `/coaches/game-day` | Game day guide |
| `/game-cards/` | `/coaches/game-cards` | Game card instructions |
| `/skills-drills/` | `/coaches/drills` | Skills & drills |
| `/pie/` | `/coaches/pie` | PIE philosophy |
| `/shootout/` | `/coaches/shootout` | Shootout guide |
| `/tournament-teams/` | `/coaches/tournament-teams` | Tournament team guide |
| `/wca/` | `/coaches/wca` | Women's Coaching Alliance |
| `/coach-faq/` | `/coaches/faqs` | Coach FAQs |
| `/coach/player-ratings/` | `/coaches/player-ratings` | Player ratings |
| `/coach/coach-information-for-tournament-play/` | `/coaches/tournament-teams` | Merge |

#### For Referees
| Current URL | New URL | Content |
|-------------|---------|---------|
| `/referee/` | `/referees` | Referee overview |
| `/referee-overview/` | `/referees` | Merge |
| `/why-i-referee/` | `/referees/why-referee` | Why referee |
| `/referee-training-home/` | `/referees/training` | Training |
| `/referee-training-calendar/` | `/referees/training` | Merge |
| `/referee-upgrades/` | `/referees/training` | Merge |
| `/ussf-referee-policy/` | `/referees/training` | Merge |
| `/referee-scheduling/` | `/referees/scheduling` | Scheduling |
| `/laws-of-the-game/` | `/referees/laws` | Laws of the game |
| `/pro/` | `/referees/youth-program` | PRO program |
| `/player-referee-organization-pro-youth-referee-program/` | `/referees/youth-program` | Merge |
| `/referee-resources/` | `/referees/resources` | Resources |
| `/referee-document-library/` | `/referees/resources` | Merge |
| `/referee-mentor-program/` | `/referees/resources` | Merge |
| `/referee-staff/` | `/referees` | Merge into overview |
| `/ask-the-referee/` | `/referees/faqs` | FAQs |
| `/respect-the-referee-2/` | `/referees/faqs` | Merge |

#### For Team Managers
| Current URL | New URL | Content |
|-------------|---------|---------|
| `/manager/` | `/managers` | Manager overview |
| `/required-training-for-team-managers/` | `/managers/training` | Training |
| `/team-manager-tasks/` | `/managers/tasks` | Tasks & checklists |

#### For Volunteers
| Current URL | New URL | Content |
|-------------|---------|---------|
| `/volunteer/` | `/volunteers` | Volunteer overview |
| `/roles/` | `/volunteers/roles` | Volunteer roles |
| `/classes/` | `/volunteers/classes` | Training classes |
| `/tent/` | `/volunteers/field-host` | Field host info |
| `/onboarding/` | `/volunteers/onboarding` | Board onboarding |
| `/volunteer-faq/` | `/volunteers/faqs` | Volunteer FAQs |
| `/sponsor/` | `/sponsors` | Sponsorship |
| `/treasurer/` | `/sponsors` | Merge (sponsorship info) |
| `/dca/` | `/volunteers/roles` | Merge into roles |

#### Fields (Individual Pages)
| Current URL | New URL | Content |
|-------------|---------|---------|
| `/map/` | `/fields` | Field map overview |
| `/goals/` | `/fields/goal-setup` | Goal setup instructions |
| `/victory/` | `/fields/victory` | Victory Park |
| `/blair/` | `/fields/blair` | Blair High School |
| `/muir/` | `/fields/muir` | Muir High School |
| `/muir-south/` | `/fields/muir-south` | Muir South |
| `/jefferson/` | `/fields/jefferson` | Jefferson |
| `/mckinley/` | `/fields/mckinley` | McKinley |
| `/mcdonald/` | `/fields/mcdonald` | McDonald Park |
| `/wilson/` | `/fields/wilson` | Wilson |
| `/brookside/` | `/fields/brookside` | Brookside |
| `/marshall/` | `/fields/marshall` | Marshall |
| `/pasadena/` | `/fields/pasadena` | Pasadena (if different) |
| `/paradise/` | `/fields/paradise` | Paradise Canyon |
| `/oak-grove/` | `/fields/oak-grove` | Oak Grove |
| `/lchs/` | `/fields/lchs` | La Cañada HS |
| `/la-canada-fields/` | `/fields/la-canada` | La Cañada overview |
| `/allendale/` | `/fields/allendale` | Allendale |
| `/cornishon/` | `/fields/cornishon` | Cornishon |
| `/lds/` | `/fields/lds` | LDS |
| `/la-salle/` | `/fields/la-salle` | La Salle |
| `/butler/` | `/fields/butler` | Butler |
| `/eaton/` | `/fields/eaton` | Eaton |
| `/pusd/` | `/fields/pusd` | PUSD |
| `/fis-upper/` | `/fields/fis-upper` | FIS Upper |
| `/fis-lower/` | `/fields/fis-lower` | FIS Lower |
| `/victory-goal-assembly/` | `/fields/victory` | Merge into field page |
| `/victory-goal-disassembly/` | `/fields/victory` | Merge |
| `/blair-goal-assembly/` | `/fields/blair` | Merge |
| `/blair-goal-disassembly/` | `/fields/blair` | Merge |
| `/practice/portable-lights/` | `/fields/portable-lights` | Portable lights info |

#### Resources
| Current URL | New URL | Content |
|-------------|---------|---------|
| `/forms/` | `/documents` | Document library |
| `/pictures/` | `/photos` | Photo gallery |
| `/photos-u10/` | `/photos` | Merge |
| `/safety/` | `/safety` | Safety info |
| `/heat/` | `/safety` | Merge (heat policy) |
| `/incident/` | `/safety` | Merge (incident reporting) |
| `/livescan/` | `/volunteers/classes` | Merge into training |
| `/tickets/` | `/tickets` | Pro game tickets |
| `/report/` | `/documents` | Game card upload - merge |

#### Contact
| Current URL | New URL | Content |
|-------------|---------|---------|
| `/contact/` | `/contact` | Contact page |
| `/feedback/` | `/feedback` | Feedback form |

#### Tournament Sub-pages (linked from tournament pages)
| Current URL | New URL | Content |
|-------------|---------|---------|
| `/bracket/` | `/tournaments/brackets` | Tournament brackets |
| `/matrix/` | `/tournaments/schedule` | Tournament schedule |
| `/flights/` | `/tournaments/standings` | Tournament standings |
| `/all-stars-rules/` | `/all-stars` | Merge into All-Stars page |

---

## PAGES TO DELETE (Review List)

**Click each link to review before confirming deletion:**

### Confirmed Deletable - WordPress/System Pages
| URL | Reason |
|-----|--------|
| [sample-page](https://ayso13.org/sample-page/) | WordPress placeholder - "This is an example page" |
| [subscribed](https://ayso13.org/subscribed/) | Form confirmation - Squarespace handles this |
| [homepage-refresh-25](https://ayso13.org/homepage-refresh-25/) | Draft/alternate homepage - content is on main homepage |

### Likely Duplicates - Please Review
| URL | Appears to Duplicate | Reason |
|-----|---------------------|--------|
| [pen](https://ayso13.org/pen/) | /register | Registration landing page duplicate |
| [fb](https://ayso13.org/fb/) | /play | "Get Started" page duplicate |
| [lc](https://ayso13.org/lc/) | /register | Registration landing page duplicate |
| [weekly](https://ayso13.org/weekly/) | /schedule | Shows "Schedule coming soon" - placeholder |
| [games](https://ayso13.org/games/) | Homepage/navigation | General site overview, no unique content |

### Year-Specific Pages - Redirect to Current Version
| URL | Redirect To | Reason |
|-----|-------------|--------|
| [age-chart-2023](https://ayso13.org/age-chart-2023/) | /age-divisions | Outdated |
| [age-chart-2024](https://ayso13.org/age-chart-2024/) | /age-divisions | Outdated |
| [thanksgiving-tournament-2024](https://ayso13.org/thanksgiving-tournament-2024/) | /thanksgiving-tournament | Year-specific |
| [thanksgiving-tournament-2024-schedule](https://ayso13.org/thanksgiving-tournament-2024-schedule/) | /thanksgiving-tournament | Year-specific |
| [thanksgiving-tournament-results-2024](https://ayso13.org/thanksgiving-tournament-results-2024/) | /thanksgiving-tournament | Year-specific |
| [thanksgiving-tournament-documents](https://ayso13.org/thanksgiving-tournament-documents/) | /thanksgiving-tournament | Merge into main page |
| [rose-city-cup-2025-final-standings](https://ayso13.org/rose-city-cup-2025-final-standings/) | /rose-city-cup | Year-specific |
| [region-13-thanksgiving-tournament-2025-final-standings](https://ayso13.org/region-13-thanksgiving-tournament-2025-final-standings/) | /thanksgiving-tournament | Year-specific |
| [springcup2024-upper-division](https://ayso13.org/springcup2024-upper-division/) | /spring-soccer | Year-specific |
| [fall-core-2025-standings](https://ayso13.org/standings/fall-core-2025-standings/) | /standings | Year-specific |
| [schedule-changelog-2025](https://ayso13.org/schedule-changelog-2025/) | /schedules | Year-specific |
| [rain-cancellation-plan-november-15-16-2025](https://ayso13.org/rain-cancellation-plan-november-15-16-2025/) | /schedules | Date-specific |

### Program Pages - Please Verify
| URL | Question | Action Needed |
|-----|----------|---------------|
| [extra](https://ayso13.org/extra/) | Region 13 doesn't run EXTRA - page says "contact us to start one" | Delete or keep as placeholder? |
| [trophies](https://ayso13.org/trophies/) | Trophy pickup announcement - time-sensitive | Delete or make into news post? |

### Unclear Purpose - Please Review
| URL | Current Content | Suggested Action |
|-----|-----------------|------------------|
| [divisions](https://ayso13.org/divisions/) | Unknown - may duplicate /age | Review & decide |
| [news](https://ayso13.org/news/) | News page | Keep as blog/news archive? |
| [practice/practice-faq](https://ayso13.org/practice/practice-faq/) | Practice FAQ | Merge into /coaches/practice |

---

## Content Migration Plan

### Phase 1: Structure Approval
- [ ] Review and approve this page structure
- [ ] Confirm deletion list above
- [ ] Finalize navigation

### Phase 2: Content Writing
- [ ] Create individual `.txt` files for each new page
- [ ] Write/consolidate content based on current pages
- [ ] Organize in folder structure matching new site

### Phase 3: Asset Collection
- [ ] Export all photos to organized folders
- [ ] Organize documents in Google Drive
- [ ] Collect logos and branding assets

### Phase 4: Build & Migration
- [ ] Set up Squarespace template
- [ ] Build page structure
- [ ] Migrate content from `.txt` files
- [ ] Upload photos and documents

### Phase 5: Redirects & Launch
- [ ] Create comprehensive redirect map
- [ ] Test all redirects
- [ ] Launch new site
- [ ] Monitor 404s and fix

---

## Content File Structure (Phase 2)

When approved, I'll create this folder structure with content files:

```
/content/
├── home.txt
├── about/
│   ├── mission.txt
│   ├── history.txt
│   ├── leadership.txt
│   ├── policies.txt
│   ├── inclusion.txt
│   ├── hall-of-fame.txt
│   ├── neighbors.txt
│   ├── sisterhood.txt
│   └── minutes.txt
├── programs/
│   ├── overview.txt
│   ├── fall-soccer.txt
│   ├── upper-division.txt
│   ├── preschool.txt
│   ├── next.txt
│   ├── winter-stars.txt
│   ├── all-stars.txt
│   ├── grad-series.txt
│   ├── spring-soccer.txt
│   ├── sunday-soccer.txt
│   ├── epic.txt
│   ├── camps.txt
│   └── tournaments/
│       ├── overview.txt
│       ├── thanksgiving.txt
│       ├── rose-city-cup.txt
│       └── spring-classic.txt
├── register/
│   ├── player.txt
│   ├── age-divisions.txt
│   └── volunteer.txt
├── schedules/
│   ├── game-schedules.txt
│   ├── standings.txt
│   ├── playoffs.txt
│   └── calendar.txt
├── parents/
│   ├── getting-started.txt
│   ├── team.txt
│   ├── equipment.txt
│   ├── pledge.txt
│   ├── faqs.txt
│   └── support.txt
├── coaches/
│   ├── overview.txt
│   ├── getting-started.txt
│   ├── training.txt
│   ├── practice.txt
│   ├── game-day.txt
│   ├── game-cards.txt
│   ├── drills.txt
│   ├── pie.txt
│   ├── shootout.txt
│   ├── tournament-teams.txt
│   ├── wca.txt
│   └── faqs.txt
├── referees/
│   ├── overview.txt
│   ├── why-referee.txt
│   ├── training.txt
│   ├── scheduling.txt
│   ├── laws.txt
│   ├── youth-program.txt
│   ├── resources.txt
│   └── faqs.txt
├── managers/
│   ├── overview.txt
│   ├── training.txt
│   ├── tasks.txt
│   └── resources.txt
├── volunteers/
│   ├── overview.txt
│   ├── roles.txt
│   ├── classes.txt
│   ├── field-host.txt
│   ├── onboarding.txt
│   ├── faqs.txt
│   └── sponsors.txt
├── fields/
│   ├── overview.txt
│   ├── goal-setup.txt
│   ├── victory.txt
│   ├── blair.txt
│   ├── [etc for each field...]
├── resources/
│   ├── documents.txt
│   ├── photos.txt
│   ├── safety.txt
│   └── tickets.txt
└── contact/
    ├── contact.txt
    └── feedback.txt
```

---

*Document revised: 2025-01-25*
