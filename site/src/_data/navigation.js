module.exports = [
  // ── TOP NAV items (topNav: true) ──────────────────────────────────────
  // These 6 items appear in the sticky header. Order matters.

  {
    label: "Programs",
    url: "/programs/",
    section: "programs",
    topNav: true,
    children: [
      { label: "All Programs",             url: "/programs/" },
      { label: "Fall Soccer (6U–14U)",     url: "/programs/fall-soccer/" },
      { label: "Upper Division (16U/19U)", url: "/programs/upper-division/" },
      { label: "Preschool (4U/5U)",        url: "/programs/preschool/" },
      { label: "NEXT",                     url: "/programs/next/" },
      { label: "Winter Stars",             url: "/programs/winter-stars/" },
      { label: "All-Stars",                url: "/programs/all-stars/" },
      { label: "Grad Series",              url: "/programs/grad-series/" },
      { label: "Spring Soccer",            url: "/programs/spring-soccer/" },
      { label: "Sunday Soccer",            url: "/programs/sunday-soccer/" },
      { label: "EPIC",                     url: "/programs/epic/" },
      { label: "Thanksgiving Tournament",  url: "/programs/tournaments/thanksgiving/", divider: true, dividerLabel: "Tournaments" },
      { label: "Rose City Cup",            url: "/programs/tournaments/rose-city-cup/" },
    ],
  },

  {
    label: "Register",
    url: "/register/",
    section: "register",
    topNav: true,
    children: [
      { label: "Player Registration",    url: "/register/" },
      { label: "Age Chart & Divisions",  url: "/register/age-chart/" },
      { label: "Volunteer Registration", url: "/register/forms/" },
    ],
  },

  {
    label: "Schedules",
    url: "/schedules/",
    section: "schedules",
    topNav: true,
    children: [
      { label: "Game Schedules",  url: "/schedules/games/" },
      { label: "Standings",       url: "/schedules/standings/" },
      { label: "Season Calendar", url: "/schedules/calendar/" },
    ],
  },

  {
    label: "Fields",
    url: "/fields/",
    section: "fields",
    topNav: true,
    children: [
      { label: "All Fields",            url: "/fields/" },
      { label: "Goal Setup",            url: "/fields/goals/" },
      { label: "Allendale Park",        url: "/fields/allendale/",  divider: true, dividerLabel: "Field Locations" },
      { label: "Area H",                url: "/fields/area-h/" },
      { label: "Blair High School",     url: "/fields/blair/" },
      { label: "Brookside Park",        url: "/fields/brookside/" },
      { label: "Jefferson Center",      url: "/fields/jefferson/" },
      { label: "La Salle High School",  url: "/fields/la-salle/" },
      { label: "La Cañada High School", url: "/fields/lchs/" },
      { label: "Marshall Fundamental",  url: "/fields/marshall/" },
      { label: "McDonald Park",         url: "/fields/mcdonald/" },
      { label: "McKinley School",       url: "/fields/mckinley/" },
      { label: "Muir High School",      url: "/fields/muir/" },
      { label: "Muir South",            url: "/fields/muir-south/" },
      { label: "Oak Grove Park",        url: "/fields/oak-grove/" },
      { label: "Paradise Canyon",       url: "/fields/paradise/" },
      { label: "Victory Park",          url: "/fields/victory/" },
      { label: "Wilson Middle School",  url: "/fields/wilson/" },
    ],
  },

  {
    label: "Parents",
    url: "/parents/",
    section: "parents",
    topNav: true,
    children: [
      { label: "Getting Started",           url: "/parents/" },
      { label: "Team Info",                 url: "/parents/team/" },
      { label: "Equipment & Uniforms",      url: "/parents/equipment/" },
      { label: "Parent Pledge",             url: "/parents/pledge/" },
      { label: "Parent FAQs",               url: "/parents/faqs/" },
      { label: "Being a Supportive Parent", url: "/parents/support/" },
      // Role sections — most parents are also coaches, refs, or managers
      { label: "Coach",         url: "/coaches/",   divider: true, dividerLabel: "I'm also a…" },
      { label: "Referee",       url: "/referees/" },
      { label: "Team Manager",  url: "/managers/" },
    ],
  },

  {
    label: "About",
    url: "/about/",
    section: "about",
    topNav: true,
    children: [
      { label: "Mission & Philosophy",  url: "/about/" },
      { label: "History",               url: "/about/history/" },
      { label: "Leadership & Board",    url: "/about/leadership/" },
      { label: "Policies",              url: "/about/policies/" },
      { label: "Fine Print",            url: "/about/fine-print/" },
      { label: "Diversity & Inclusion", url: "/about/inclusion/" },
      { label: "Hall of Fame",          url: "/about/hall-of-fame/" },
      { label: "Neighbors",             url: "/about/neighbors/" },
      { label: "Sisterhood of Soccer",  url: "/about/sisterhood/" },
      { label: "Board Minutes",         url: "/about/board-minutes/" },
    ],
  },

  // ── FOOTER-ONLY items (topNav: false) ────────────────────────────────
  // Not shown in the header. Still used for section sidebars.

  {
    label: "Coaches",
    url: "/coaches/",
    section: "coaches",
    topNav: false,
    children: [
      { label: "Coach Overview",            url: "/coaches/" },
      { label: "Getting Started",           url: "/coaches/getting-started/" },
      { label: "Training & Certification",  url: "/coaches/training/" },
      { label: "Practice Resources",        url: "/coaches/practice/" },
      { label: "Game Day Guide",            url: "/coaches/game-day/" },
      { label: "Game Cards",                url: "/coaches/game-cards/" },
      { label: "Skills & Drills",           url: "/coaches/drills/" },
      { label: "PIE Philosophy",            url: "/coaches/pie/" },
      { label: "Shootout Guide",            url: "/coaches/shootout/" },
      { label: "Tournament Teams",          url: "/coaches/tournament-teams/" },
      { label: "Women's Coaching Alliance", url: "/coaches/wca/" },
      { label: "Player Ratings",            url: "/coaches/player-ratings/" },
      { label: "Coach FAQs",                url: "/coaches/faqs/" },
    ],
  },

  {
    label: "Referees",
    url: "/referees/",
    section: "referees",
    topNav: false,
    children: [
      { label: "Referee Overview",           url: "/referees/" },
      { label: "Training & Certification",   url: "/referees/training/" },
      { label: "Referee Scheduling",         url: "/referees/scheduling/" },
      { label: "Laws of the Game",           url: "/referees/laws/" },
      { label: "Youth Referee Program (PRO)",url: "/referees/pro/" },
      { label: "Referee Resources",          url: "/referees/resources/" },
      { label: "Upgrades",                   url: "/referees/upgrades/" },
      { label: "Referee FAQs",               url: "/referees/faqs/" },
    ],
  },

  {
    label: "Team Managers",
    url: "/managers/",
    section: "managers",
    topNav: false,
    children: [
      { label: "Manager Overview",      url: "/managers/" },
      { label: "Training Requirements", url: "/managers/training/" },
      { label: "Tasks & Checklists",    url: "/managers/tasks/" },
      { label: "Manager FAQs",          url: "/managers/faqs/" },
    ],
  },

  {
    label: "Volunteers",
    url: "/volunteers/",
    section: "volunteers",
    topNav: false,
    children: [
      { label: "Volunteer Overview", url: "/volunteers/" },
      { label: "Volunteer Roles",    url: "/volunteers/roles/" },
      { label: "Training Classes",   url: "/volunteers/classes/" },
      { label: "Field Host (Tent)",  url: "/volunteers/tent/" },
      { label: "Board Onboarding",   url: "/volunteers/onboarding/" },
      { label: "Sponsors",           url: "/volunteers/sponsors/" },
      { label: "Volunteer FAQs",     url: "/volunteers/faqs/" },
    ],
  },

  {
    label: "Resources",
    url: "/resources/",
    section: "resources",
    topNav: false,
    children: [
      { label: "Resources Overview",  url: "/resources/" },
      { label: "Document Library",    url: "/resources/documents/" },
      { label: "Photo Gallery",       url: "/resources/gallery/" },
      { label: "Newsletter",          url: "/resources/newsletter/" },
      { label: "Safety & Heat Policy",url: "/resources/safety/" },
    ],
  },

  {
    label: "Contact",
    url: "/contact/",
    section: "contact",
    topNav: false,
    children: [
      { label: "Contact Us", url: "/contact/" },
      { label: "Feedback",   url: "/contact/feedback/" },
    ],
  },
];
