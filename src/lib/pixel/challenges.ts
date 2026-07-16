// The Pixel Lab catalog.
//
// CLIENT-SAFE. Imported by the arena and shipped to the browser. It carries the
// brief, the canvas, and — for `match`/`page` — the target image, because the
// learner has to see what they are reproducing.
//
// What it must never carry is `reference`. That lives in challenges-expected.ts
// behind `server-only`, and for `brief` challenges the target image is
// server-side too. Same split as problems.ts / problems-expected.ts.

export const TOPIC_IDS = ['foundations', 'navbar', 'hero', 'cta', 'card', 'footer', 'pricing', 'page'] as const
export type TopicId = (typeof TOPIC_IDS)[number]

/**
 * `brief` — the target is **not** shown. The spec is the brief, and it has to be
 *   pixel-determined ("a 320x200 box, #1e293b, 12px radius, centred") rather than
 *   a design brief, or there is no single correct render to diff against. Warm-ups,
 *   and the one kind here that cannot be copied — you cannot submit an image you
 *   have never seen.
 * `match` — the target is shown. Reproduce it. The core of the lab.
 * `page`  — as `match`, on a full-page canvas. The finale.
 */
export type ChallengeKind = 'brief' | 'match' | 'page'

export interface Canvas {
  width: number
  height: number
}

export interface PixelChallenge {
  id: string
  topicId: TopicId
  kind: ChallengeKind
  title: string
  /** Shown above the editor. For `brief`, this is the entire specification. */
  brief: string
  canvas: Canvas
  /** Public URL of the target. Present for `match`/`page`, absent for `brief`. */
  targetPng?: string
  starterHtml: string
  starterCss: string
  // There is deliberately no per-challenge scoring knob here.
  //
  // There used to be: `perfectAt`, tuned by hand on twelve of these from each
  // target's measured ink density, because a percentage of the whole canvas is a
  // weak signal on a sparse layout — a 1280x72 navbar is 2.6% ink, so moving the
  // logo 48px shifts under 1% of the pixels. That patched the top tier, one
  // challenge at a time, and left the others: an empty editor scored 98.9% on
  // hero-04 and was paid Standing and Close for it.
  //
  // The score is now measured from what a blank canvas gets (lib/pixel/score.ts),
  // which fixes all three tiers everywhere at once and needs nothing per
  // challenge. If you find yourself wanting a knob here, the bars in score.ts are
  // probably what actually wants moving.
  /** Rough minutes, for the card. Not enforced. */
  estimate: number
}

export interface PixelTopic {
  id: TopicId
  title: string
  blurb: string
  challenges: PixelChallenge[]
}

/**
 * The same starter for all 27, and commented on purpose.
 *
 * A live `.box { }` rule would be dead code on 26 of them. Every challenge ships
 * different markup — 27 challenges, 27 distinct class signatures, and only
 * found-01 has a `.box` — so a shared *live* scaffold would have the learner
 * typing into a selector their HTML does not contain, watching nothing happen,
 * with no clue why. Commented, the identical text teaches the shape everywhere
 * and traps nobody: read your HTML, style the classes that are actually in it.
 *
 * Changing this changes every challenge's starting document, and
 * challenges.test.ts asserts each starter's markup still matches its reference.
 */
const STARTER_CSS = `/* You write the CSS. The HTML, the reset and the font are already there.
   Look at the HTML tab and style the classes it actually uses. For example:

   .box {
     width: 200px;
     height: 120px;
     background: #1e293b;
     border-radius: 12px;
   }

   Colours and gradients both work — background: linear-gradient(...) is fine.
   Images are not: this lab is pure CSS.

   One trap: your HTML lives inside a fixed-size #canvas element, and only
   #canvas is scored — so body { background: ... } paints a body you will
   never see. To colour the whole canvas, target #canvas instead:

   #canvas { background: red; } */
`

// Targets are served by a route and exist nowhere on disk — each one is rendered
// from its reference on demand (see lib/pixel/target.ts). That is what makes
// `brief` mean something: a file in public/ would be readable by anyone who
// guesses the URL, and the challenge id is right here in this catalog, so
// "unlinked" would not be "unseen". The route refuses to serve a `brief` target
// at all.
const target = (id: string) => `/api/labs/pixel-lab/target/${id}`

export const PIXEL_TOPICS: PixelTopic[] = [
  {
    id: 'foundations',
    title: 'Warm-ups',
    blurb: 'No picture. Read the spec, hit it exactly.',
    challenges: [
      {
        id: 'found-01',
        topicId: 'foundations',
        kind: 'brief',
        title: 'One Box',
        brief:
          'On the 400x300 canvas: a single box, 200px wide and 120px tall, background #1e293b, 12px rounded corners, positioned 100px from the left and 90px from the top.',
        canvas: { width: 400, height: 300 },
        estimate: 5,
        starterHtml: `<div class="box"></div>\n`,
        starterCss: STARTER_CSS,
      },
      {
        id: 'found-02',
        topicId: 'foundations',
        kind: 'brief',
        title: 'Dead Centre',
        brief:
          'On the 400x300 canvas: a 160x160 square, background #0ea5e9, 50% rounded (so, a circle), centred exactly both ways.',
        canvas: { width: 400, height: 300 },
        estimate: 6,
        starterHtml: `<div class="dot"></div>\n`,
        starterCss: STARTER_CSS,
      },
      {
        id: 'found-03',
        topicId: 'foundations',
        kind: 'brief',
        title: 'Three In A Row',
        brief:
          'On the 400x300 canvas: three 80x80 squares in a horizontal row, 20px apart, background #f59e0b, the whole row centred both ways.',
        canvas: { width: 400, height: 300 },
        estimate: 8,
        starterHtml: `<div class="row">\n  <div class="sq"></div>\n  <div class="sq"></div>\n  <div class="sq"></div>\n</div>\n`,
        starterCss: STARTER_CSS,
      },
      {
        id: 'found-04',
        topicId: 'foundations',
        kind: 'brief',
        title: 'Label It',
        brief:
          'On the 400x300 canvas: a 240x100 box, background #ffffff, 2px solid #cbd5e1 border, 8px radius, centred both ways. Inside it, centred both ways, the text "Ship it" at 20px, weight 600, colour #0f172a.',
        canvas: { width: 400, height: 300 },
        estimate: 8,
        starterHtml: `<div class="card">Ship it</div>\n`,
        starterCss: STARTER_CSS,
      },
    ],
  },
  {
    id: 'navbar',
    title: 'Navbars',
    blurb: 'The bar at the top of every site you have ever used.',
    challenges: [
      {
        id: 'navbar-01',
        topicId: 'navbar',
        kind: 'match',
        title: 'The Plain Bar',
        brief: 'Logo hard left, three links hard right, one hairline along the bottom.',
        canvas: { width: 1280, height: 72 },
        targetPng: target('navbar-01'),
        estimate: 10,
        starterHtml: `<header class="bar">\n  <a class="logo" href="#">phi</a>\n  <nav class="links">\n    <a href="#">Labs</a>\n    <a href="#">Hive</a>\n    <a href="#">Profile</a>\n  </nav>\n</header>\n`,
        starterCss: STARTER_CSS,
      },
      {
        id: 'navbar-02',
        topicId: 'navbar',
        kind: 'match',
        title: 'Centred Links',
        brief: 'Logo left, links dead centre of the bar, a button on the right.',
        canvas: { width: 1280, height: 72 },
        targetPng: target('navbar-02'),
        estimate: 12,
        starterHtml: `<header class="bar">\n  <a class="logo" href="#">phi</a>\n  <nav class="links">\n    <a href="#">Product</a>\n    <a href="#">Pricing</a>\n    <a href="#">Docs</a>\n  </nav>\n  <button class="cta">Sign in</button>\n</header>\n`,
        starterCss: STARTER_CSS,
      },
      {
        id: 'navbar-03',
        topicId: 'navbar',
        kind: 'match',
        title: 'The Dark Bar',
        brief: 'Dark bar, a pill-shaped active link, and a filled button on the right.',
        canvas: { width: 1280, height: 72 },
        targetPng: target('navbar-03'),
        estimate: 12,
        starterHtml: `<header class="bar">\n  <a class="logo" href="#">phi</a>\n  <nav class="links">\n    <a class="on" href="#">Home</a>\n    <a href="#">Labs</a>\n    <a href="#">Hive</a>\n  </nav>\n  <button class="cta">Get started</button>\n</header>\n`,
        starterCss: STARTER_CSS,
      },
      {
        id: 'navbar-04',
        topicId: 'navbar',
        kind: 'match',
        title: 'Two Decks',
        brief: 'A thin utility strip above the main bar. Two rows, one header.',
        canvas: { width: 1280, height: 72 },
        targetPng: target('navbar-04'),
        estimate: 14,
        starterHtml: `<header class="bar">\n  <div class="top">\n    <span>Free shipping over $50</span>\n  </div>\n  <div class="main">\n    <a class="logo" href="#">phi</a>\n    <nav class="links">\n      <a href="#">Shop</a>\n      <a href="#">About</a>\n    </nav>\n  </div>\n</header>\n`,
        starterCss: STARTER_CSS,
      },
      {
        id: 'navbar-05',
        topicId: 'navbar',
        kind: 'match',
        title: 'The Search Bar',
        brief: 'Logo left, a search field taking the space in the middle, avatar right.',
        canvas: { width: 1280, height: 72 },
        targetPng: target('navbar-05'),
        estimate: 14,
        starterHtml: `<header class="bar">\n  <a class="logo" href="#">phi</a>\n  <div class="search">Search the labs</div>\n  <div class="avatar">FS</div>\n</header>\n`,
        starterCss: STARTER_CSS,
      },
    ],
  },
  {
    id: 'hero',
    title: 'Heroes',
    blurb: 'The first screen. Big type, one job.',
    challenges: [
      {
        id: 'hero-01',
        topicId: 'hero',
        kind: 'match',
        title: 'Centred Hero',
        brief: 'Eyebrow, big headline, a line of body copy, two buttons. All centred.',
        canvas: { width: 1280, height: 480 },
        targetPng: target('hero-01'),
        estimate: 15,
        starterHtml: `<section class="hero">\n  <p class="eyebrow">Now in beta</p>\n  <h1>Learn the web by building it</h1>\n  <p class="sub">Twenty challenges. One pixel at a time.</p>\n  <div class="actions">\n    <button class="primary">Start building</button>\n    <button class="ghost">See a demo</button>\n  </div>\n</section>\n`,
        starterCss: STARTER_CSS,
      },
      {
        id: 'hero-02',
        topicId: 'hero',
        kind: 'match',
        title: 'Split Hero',
        brief: 'Copy on the left half, a flat colour panel on the right half.',
        canvas: { width: 1280, height: 480 },
        targetPng: target('hero-02'),
        estimate: 15,
        starterHtml: `<section class="hero">\n  <div class="copy">\n    <h1>Ship your first page today</h1>\n    <p>No setup. No install. Just you and the box model.</p>\n    <button class="primary">Get started</button>\n  </div>\n  <div class="art"></div>\n</section>\n`,
        starterCss: STARTER_CSS,
      },
      {
        id: 'hero-03',
        topicId: 'hero',
        kind: 'match',
        title: 'The Dark Hero',
        brief: 'Dark background, centred copy, one button, three logos along the bottom.',
        canvas: { width: 1280, height: 480 },
        targetPng: target('hero-03'),
        estimate: 16,
        starterHtml: `<section class="hero">\n  <h1>Built for people who build</h1>\n  <p class="sub">Join 4,000 developers learning in the open.</p>\n  <button class="primary">Join free</button>\n  <div class="logos">\n    <span>ACME</span>\n    <span>GLOBEX</span>\n    <span>INITECH</span>\n  </div>\n</section>\n`,
        starterCss: STARTER_CSS,
      },
      {
        id: 'hero-04',
        topicId: 'hero',
        kind: 'match',
        title: 'Hero With Stats',
        brief: 'Headline and copy up top, a row of three stats underneath, divided.',
        canvas: { width: 1280, height: 480 },
        targetPng: target('hero-04'),
        estimate: 16,
        starterHtml: `<section class="hero">\n  <h1>The numbers so far</h1>\n  <p class="sub">Every one of them earned a pixel at a time.</p>\n  <div class="stats">\n    <div class="stat"><strong>4,281</strong><span>Learners</span></div>\n    <div class="stat"><strong>92%</strong><span>Finish rate</span></div>\n    <div class="stat"><strong>120k</strong><span>Submissions</span></div>\n  </div>\n</section>\n`,
        starterCss: STARTER_CSS,
      },
    ],
  },
  {
    id: 'cta',
    title: 'Calls To Action',
    blurb: 'One box, one decision.',
    challenges: [
      {
        id: 'cta-01',
        topicId: 'cta',
        kind: 'match',
        title: 'The Banner',
        brief: 'Full-width tinted panel: headline left, button right, vertically centred.',
        canvas: { width: 960, height: 320 },
        targetPng: target('cta-01'),
        estimate: 10,
        starterHtml: `<section class="cta">\n  <div class="copy">\n    <h2>Ready to start?</h2>\n    <p>Your first challenge takes five minutes.</p>\n  </div>\n  <button class="primary">Start now</button>\n</section>\n`,
        starterCss: STARTER_CSS,
      },
      {
        id: 'cta-02',
        topicId: 'cta',
        kind: 'match',
        title: 'The Signup Strip',
        brief: 'Centred headline with an input and button sitting side by side beneath it.',
        canvas: { width: 960, height: 320 },
        targetPng: target('cta-02'),
        estimate: 12,
        starterHtml: `<section class="cta">\n  <h2>Get the weekly challenge</h2>\n  <p>One email. One build. Every Monday.</p>\n  <div class="form">\n    <div class="field">you@example.com</div>\n    <button class="primary">Subscribe</button>\n  </div>\n</section>\n`,
        starterCss: STARTER_CSS,
      },
      {
        id: 'cta-03',
        topicId: 'cta',
        kind: 'match',
        title: 'The Bordered Card',
        brief: 'A bordered card on a tinted field, everything centred, one outlined button.',
        canvas: { width: 960, height: 320 },
        targetPng: target('cta-03'),
        estimate: 12,
        starterHtml: `<section class="cta">\n  <div class="card">\n    <h2>Still deciding?</h2>\n    <p>Try one challenge. No account needed.</p>\n    <button class="ghost">Try a challenge</button>\n  </div>\n</section>\n`,
        starterCss: STARTER_CSS,
      },
    ],
  },
  {
    id: 'card',
    title: 'Cards',
    blurb: 'The unit every list is made of.',
    challenges: [
      {
        id: 'card-01',
        topicId: 'card',
        kind: 'match',
        title: 'Product Card',
        brief: 'Image block on top, title, price, and a full-width button at the bottom.',
        canvas: { width: 360, height: 420 },
        targetPng: target('card-01'),
        estimate: 12,
        starterHtml: `<article class="card">\n  <div class="thumb"></div>\n  <div class="body">\n    <h3>Mechanical Keyboard</h3>\n    <p class="price">$149</p>\n    <button class="primary">Add to cart</button>\n  </div>\n</article>\n`,
        starterCss: STARTER_CSS,
      },
      {
        id: 'card-02',
        topicId: 'card',
        kind: 'match',
        title: 'Profile Card',
        brief: 'Circular avatar centred, name, role, and two stats side by side.',
        canvas: { width: 360, height: 420 },
        targetPng: target('card-02'),
        estimate: 12,
        starterHtml: `<article class="card">\n  <div class="avatar">FS</div>\n  <h3>Faisal Shohag</h3>\n  <p class="role">Instructor</p>\n  <div class="stats">\n    <div><strong>128</strong><span>Builds</span></div>\n    <div><strong>4.9</strong><span>Rating</span></div>\n  </div>\n</article>\n`,
        starterCss: STARTER_CSS,
      },
      {
        id: 'card-03',
        topicId: 'card',
        kind: 'match',
        title: 'The Pricing Tile',
        brief: 'A badge in the corner, big price, a feature list with ticks, one button.',
        canvas: { width: 360, height: 420 },
        targetPng: target('card-03'),
        estimate: 14,
        starterHtml: `<article class="card">\n  <span class="badge">Popular</span>\n  <h3>Pro</h3>\n  <p class="price">$12<span>/mo</span></p>\n  <ul class="features">\n    <li>Every challenge</li>\n    <li>Weekly leaderboard</li>\n    <li>Solution replays</li>\n  </ul>\n  <button class="primary">Choose Pro</button>\n</article>\n`,
        starterCss: STARTER_CSS,
      },
      {
        id: 'card-04',
        topicId: 'card',
        kind: 'match',
        title: 'The Notification',
        brief: 'Icon square left, text right, timestamp bottom-right, subtle left accent.',
        canvas: { width: 360, height: 420 },
        targetPng: target('card-04'),
        estimate: 14,
        starterHtml: `<article class="card">\n  <div class="icon">!</div>\n  <div class="body">\n    <h3>Build failed</h3>\n    <p>Your last submission scored 61%. The header is 8px too tall.</p>\n    <span class="time">2 minutes ago</span>\n  </div>\n</article>\n`,
        starterCss: STARTER_CSS,
      },
    ],
  },
  {
    id: 'footer',
    title: 'Footers',
    blurb: 'The bit nobody designs and everybody ships.',
    challenges: [
      {
        id: 'footer-01',
        topicId: 'footer',
        kind: 'match',
        title: 'Four Columns',
        brief: 'Four link columns with headings, a rule, and a copyright line under it.',
        canvas: { width: 1280, height: 280 },
        targetPng: target('footer-01'),
        estimate: 14,
        starterHtml: `<footer class="foot">\n  <div class="cols">\n    <div class="col"><h4>Product</h4><a href="#">Labs</a><a href="#">Pricing</a></div>\n    <div class="col"><h4>Learn</h4><a href="#">Guides</a><a href="#">Blog</a></div>\n    <div class="col"><h4>Company</h4><a href="#">About</a><a href="#">Careers</a></div>\n    <div class="col"><h4>Legal</h4><a href="#">Terms</a><a href="#">Privacy</a></div>\n  </div>\n  <div class="base">© 2026 phi-lab</div>\n</footer>\n`,
        starterCss: STARTER_CSS,
      },
      {
        id: 'footer-02',
        topicId: 'footer',
        kind: 'match',
        title: 'The Simple Footer',
        brief: 'Logo and copyright left, a row of links right, all on one line, dark.',
        canvas: { width: 1280, height: 280 },
        targetPng: target('footer-02'),
        estimate: 10,
        starterHtml: `<footer class="foot">\n  <div class="left">\n    <span class="logo">phi</span>\n    <span class="copy">© 2026 phi-lab</span>\n  </div>\n  <nav class="links">\n    <a href="#">Terms</a>\n    <a href="#">Privacy</a>\n    <a href="#">Contact</a>\n  </nav>\n</footer>\n`,
        starterCss: STARTER_CSS,
      },
      {
        id: 'footer-03',
        topicId: 'footer',
        kind: 'match',
        title: 'Footer With Signup',
        brief: 'Links left, a newsletter field and button on the right, rule, base line.',
        canvas: { width: 1280, height: 280 },
        targetPng: target('footer-03'),
        estimate: 15,
        starterHtml: `<footer class="foot">\n  <div class="top">\n    <nav class="links">\n      <a href="#">Labs</a>\n      <a href="#">Hive</a>\n      <a href="#">Docs</a>\n    </nav>\n    <div class="signup">\n      <div class="field">you@example.com</div>\n      <button class="primary">Subscribe</button>\n    </div>\n  </div>\n  <div class="base">© 2026 phi-lab</div>\n</footer>\n`,
        starterCss: STARTER_CSS,
      },
    ],
  },
  {
    id: 'pricing',
    title: 'Pricing Tables',
    blurb: 'Three columns and a lot of alignment.',
    challenges: [
      {
        id: 'pricing-01',
        topicId: 'pricing',
        kind: 'match',
        title: 'Three Tiers',
        brief: 'Three equal plans in a row, the middle one lifted and highlighted.',
        canvas: { width: 1280, height: 520 },
        targetPng: target('pricing-01'),
        estimate: 18,
        starterHtml: `<section class="plans">\n  <article class="plan"><h3>Free</h3><p class="price">$0</p><ul><li>Three challenges</li><li>Community</li></ul><button class="ghost">Start</button></article>\n  <article class="plan on"><h3>Pro</h3><p class="price">$12</p><ul><li>Everything</li><li>Leaderboard</li></ul><button class="primary">Choose Pro</button></article>\n  <article class="plan"><h3>Team</h3><p class="price">$40</p><ul><li>Seats</li><li>Reports</li></ul><button class="ghost">Contact</button></article>\n</section>\n`,
        starterCss: STARTER_CSS,
      },
      {
        id: 'pricing-02',
        topicId: 'pricing',
        kind: 'match',
        title: 'The Comparison Row',
        brief: 'A feature table: header row, four rows of ticks and crosses, zebra striping.',
        canvas: { width: 1280, height: 520 },
        targetPng: target('pricing-02'),
        estimate: 18,
        starterHtml: `<table class="cmp">\n  <thead>\n    <tr><th>Feature</th><th>Free</th><th>Pro</th></tr>\n  </thead>\n  <tbody>\n    <tr><td>Challenges</td><td>3</td><td>All</td></tr>\n    <tr><td>Leaderboard</td><td>No</td><td>Yes</td></tr>\n    <tr><td>Replays</td><td>No</td><td>Yes</td></tr>\n    <tr><td>Support</td><td>Community</td><td>Email</td></tr>\n  </tbody>\n</table>\n`,
        starterCss: STARTER_CSS,
      },
    ],
  },
  {
    id: 'page',
    title: 'Whole Pages',
    blurb: 'Everything above, at once.',
    challenges: [
      {
        id: 'page-01',
        topicId: 'page',
        kind: 'page',
        title: 'The Landing Page',
        brief: 'Navbar, hero, a three-card feature row, a CTA band, and a footer.',
        canvas: { width: 1280, height: 1600 },
        targetPng: target('page-01'),
        estimate: 40,
        starterHtml: `<header class="bar">\n  <a class="logo" href="#">phi</a>\n  <nav class="links"><a href="#">Labs</a><a href="#">Pricing</a></nav>\n  <button class="cta">Sign in</button>\n</header>\n<section class="hero">\n  <h1>Learn the web by building it</h1>\n  <p>One pixel at a time.</p>\n  <button class="primary">Start building</button>\n</section>\n<section class="features">\n  <article class="feature"><h3>Build</h3><p>Write the markup.</p></article>\n  <article class="feature"><h3>Match</h3><p>Hit the target.</p></article>\n  <article class="feature"><h3>Climb</h3><p>Take the board.</p></article>\n</section>\n<section class="band">\n  <h2>Ready?</h2>\n  <button class="primary">Start now</button>\n</section>\n<footer class="foot">© 2026 phi-lab</footer>\n`,
        starterCss: STARTER_CSS,
      },
      {
        id: 'page-02',
        topicId: 'page',
        kind: 'page',
        title: 'The Dashboard',
        brief: 'Sidebar, top bar, a row of stat tiles, and a table filling the rest.',
        canvas: { width: 1280, height: 1600 },
        targetPng: target('page-02'),
        estimate: 45,
        starterHtml: `<div class="shell">\n  <aside class="side">\n    <span class="logo">phi</span>\n    <nav><a class="on" href="#">Overview</a><a href="#">Builds</a><a href="#">Team</a></nav>\n  </aside>\n  <main class="main">\n    <header class="top"><h1>Overview</h1><div class="avatar">FS</div></header>\n    <section class="tiles">\n      <div class="tile"><span>Builds</span><strong>128</strong></div>\n      <div class="tile"><span>Match</span><strong>94%</strong></div>\n      <div class="tile"><span>Rank</span><strong>#7</strong></div>\n    </section>\n    <table class="rows">\n      <thead><tr><th>Challenge</th><th>Score</th></tr></thead>\n      <tbody>\n        <tr><td>Navbar 01</td><td>98%</td></tr>\n        <tr><td>Hero 02</td><td>91%</td></tr>\n        <tr><td>Card 03</td><td>87%</td></tr>\n      </tbody>\n    </table>\n  </main>\n</div>\n`,
        starterCss: STARTER_CSS,
      },
    ],
  },
]

export const ALL_CHALLENGES: PixelChallenge[] = PIXEL_TOPICS.flatMap((t) => t.challenges)
export const TOTAL_CHALLENGES = ALL_CHALLENGES.length

export const CHALLENGE_BY_ID: Record<string, PixelChallenge> = Object.fromEntries(
  ALL_CHALLENGES.map((c) => [c.id, c]),
)

export function challengeById(id: string): PixelChallenge | undefined {
  return CHALLENGE_BY_ID[id]
}
