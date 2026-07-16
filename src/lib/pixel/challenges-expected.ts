// SERVER-ONLY. The reference implementation behind every challenge.
//
// Never import this from a client component. `challenges.ts` ships to the
// browser and carries the brief; this carries the answer. Same split as
// problems.ts / problems-expected.ts.
//
// **This file is the source of truth for what every target looks like.** There
// is no stored PNG anywhere; a target is a *render of the code below*, produced
// on demand through the exact renderer a learner's submission goes through (see
// render.ts). Both sides of every diff therefore come out of one browser in one
// invocation, which is what lets a correct answer land on exactly 1.0.
//
// That also means editing a reference just changes the challenge — correctly,
// immediately, everywhere, with nothing to regenerate and nothing to forget. An
// earlier build stored the targets as committed PNGs and had to warn here that
// editing a reference silently re-scored the challenge against a picture nobody
// could reproduce. Rendering on demand does not make that bug rarer; it makes it
// unrepresentable, because there is no second artifact to drift.
import 'server-only'

import { ALL_CHALLENGES } from './challenges'

/**
 * A target is either code we render, or a picture somebody drew.
 *
 * `targetFile` exists for designer art, which has no code to render. **Nothing
 * uses it today, and think hard before something does.** A file-backed target
 * was not produced by the learner's renderer, so nobody can reach 1.0 against
 * it: it would need its own lowered bar, and calling that "Pixel perfect" would
 * be a lie on the one lab whose whole point is that the score is honest. The
 * read path exists so the door is open, not because it should be walked through.
 */
export type ChallengeReference = RenderedReference | { targetFile: string }

export interface RenderedReference {
  html: string
  css: string
}

export function isRenderedReference(reference: ChallengeReference): reference is RenderedReference {
  return 'html' in reference
}

// Shared palette. Repeated literally in each reference rather than pulled from
// variables, because the reference is also the model answer a learner is
// implicitly reproducing, and indirection would make it harder to read than the
// thing it explains.
export const CHALLENGE_REFERENCES: Record<string, ChallengeReference> = {
  // ── Warm-ups ─────────────────────────────────────────────────────────────
  'found-01': {
    html: `<div class="box"></div>\n`,
    css: `.box {
  position: absolute;
  left: 100px;
  top: 90px;
  width: 200px;
  height: 120px;
  background: #1e293b;
  border-radius: 12px;
}
`,
  },

  'found-02': {
    html: `<div class="dot"></div>\n`,
    css: `#canvas {
  display: flex;
  align-items: center;
  justify-content: center;
}
.dot {
  width: 160px;
  height: 160px;
  background: #0ea5e9;
  border-radius: 50%;
}
`,
  },

  'found-03': {
    html: `<div class="row">\n  <div class="sq"></div>\n  <div class="sq"></div>\n  <div class="sq"></div>\n</div>\n`,
    css: `#canvas {
  display: flex;
  align-items: center;
  justify-content: center;
}
.row {
  display: flex;
  gap: 20px;
}
.sq {
  width: 80px;
  height: 80px;
  background: #f59e0b;
}
`,
  },

  'found-04': {
    html: `<div class="card">Ship it</div>\n`,
    css: `#canvas {
  display: flex;
  align-items: center;
  justify-content: center;
}
.card {
  width: 240px;
  height: 100px;
  background: #ffffff;
  border: 2px solid #cbd5e1;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 600;
  color: #0f172a;
}
`,
  },

  // ── Navbars ──────────────────────────────────────────────────────────────
  'navbar-01': {
    html: `<header class="bar">\n  <a class="logo" href="#">phi</a>\n  <nav class="links">\n    <a href="#">Labs</a>\n    <a href="#">Hive</a>\n    <a href="#">Profile</a>\n  </nav>\n</header>\n`,
    css: `.bar {
  width: 100%;
  height: 72px;
  padding: 0 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e2e8f0;
  background: #ffffff;
}
.logo {
  font-size: 22px;
  font-weight: 600;
  color: #0f172a;
}
.links {
  display: flex;
  gap: 28px;
}
.links a {
  font-size: 15px;
  color: #475569;
}
`,
  },

  'navbar-02': {
    html: `<header class="bar">\n  <a class="logo" href="#">phi</a>\n  <nav class="links">\n    <a href="#">Product</a>\n    <a href="#">Pricing</a>\n    <a href="#">Docs</a>\n  </nav>\n  <button class="cta">Sign in</button>\n</header>\n`,
    css: `.bar {
  width: 100%;
  height: 72px;
  padding: 0 32px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid #e2e8f0;
  background: #ffffff;
}
.logo {
  font-size: 22px;
  font-weight: 600;
  color: #0f172a;
  width: 160px;
}
.links {
  flex: 1;
  display: flex;
  justify-content: center;
  gap: 32px;
}
.links a {
  font-size: 15px;
  color: #475569;
}
.cta {
  width: 160px;
  display: flex;
  justify-content: flex-end;
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
  cursor: pointer;
}
`,
  },

  'navbar-03': {
    html: `<header class="bar">\n  <a class="logo" href="#">phi</a>\n  <nav class="links">\n    <a class="on" href="#">Home</a>\n    <a href="#">Labs</a>\n    <a href="#">Hive</a>\n  </nav>\n  <button class="cta">Get started</button>\n</header>\n`,
    css: `.bar {
  width: 100%;
  height: 72px;
  padding: 0 32px;
  display: flex;
  align-items: center;
  gap: 40px;
  background: #0f172a;
}
.logo {
  font-size: 22px;
  font-weight: 600;
  color: #f8fafc;
}
.links {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}
.links a {
  padding: 8px 16px;
  border-radius: 999px;
  font-size: 15px;
  color: #94a3b8;
}
.links a.on {
  background: #1e293b;
  color: #f8fafc;
}
.cta {
  padding: 10px 20px;
  border-radius: 8px;
  background: #f8fafc;
  color: #0f172a;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
`,
  },

  'navbar-04': {
    html: `<header class="bar">\n  <div class="top">\n    <span>Free shipping over $50</span>\n  </div>\n  <div class="main">\n    <a class="logo" href="#">phi</a>\n    <nav class="links">\n      <a href="#">Shop</a>\n      <a href="#">About</a>\n    </nav>\n  </div>\n</header>\n`,
    css: `.bar {
  width: 100%;
  height: 72px;
  display: flex;
  flex-direction: column;
  background: #ffffff;
}
.top {
  height: 28px;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.main {
  flex: 1;
  padding: 0 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e2e8f0;
}
.logo {
  font-size: 20px;
  font-weight: 600;
  color: #0f172a;
}
.links {
  display: flex;
  gap: 24px;
}
.links a {
  font-size: 14px;
  color: #475569;
}
`,
  },

  'navbar-05': {
    html: `<header class="bar">\n  <a class="logo" href="#">phi</a>\n  <div class="search">Search the labs</div>\n  <div class="avatar">FS</div>\n</header>\n`,
    css: `.bar {
  width: 100%;
  height: 72px;
  padding: 0 32px;
  display: flex;
  align-items: center;
  gap: 24px;
  border-bottom: 1px solid #e2e8f0;
  background: #ffffff;
}
.logo {
  font-size: 22px;
  font-weight: 600;
  color: #0f172a;
}
.search {
  flex: 1;
  height: 40px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #f8fafc;
  font-size: 14px;
  color: #94a3b8;
}
.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #1e293b;
  color: #f8fafc;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
`,
  },

  // ── Heroes ───────────────────────────────────────────────────────────────
  'hero-01': {
    html: `<section class="hero">\n  <p class="eyebrow">Now in beta</p>\n  <h1>Learn the web by building it</h1>\n  <p class="sub">Twenty challenges. One pixel at a time.</p>\n  <div class="actions">\n    <button class="primary">Start building</button>\n    <button class="ghost">See a demo</button>\n  </div>\n</section>\n`,
    css: `.hero {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: #f8fafc;
}
.eyebrow {
  padding: 6px 14px;
  border-radius: 999px;
  background: #e0f2fe;
  color: #0369a1;
  font-size: 13px;
  font-weight: 600;
}
h1 {
  font-size: 56px;
  font-weight: 600;
  color: #0f172a;
}
.sub {
  font-size: 18px;
  color: #64748b;
}
.actions {
  margin-top: 8px;
  display: flex;
  gap: 12px;
}
.primary {
  padding: 12px 24px;
  border-radius: 8px;
  background: #0f172a;
  color: #f8fafc;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
.ghost {
  padding: 12px 24px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #0f172a;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
`,
  },

  'hero-02': {
    html: `<section class="hero">\n  <div class="copy">\n    <h1>Ship your first page today</h1>\n    <p>No setup. No install. Just you and the box model.</p>\n    <button class="primary">Get started</button>\n  </div>\n  <div class="art"></div>\n</section>\n`,
    css: `.hero {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
}
.copy {
  padding: 0 64px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 20px;
  background: #ffffff;
}
h1 {
  font-size: 44px;
  font-weight: 600;
  color: #0f172a;
}
.copy p {
  font-size: 17px;
  color: #64748b;
}
.primary {
  padding: 12px 24px;
  border-radius: 8px;
  background: #0ea5e9;
  color: #ffffff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
.art {
  background: #0f172a;
}
`,
  },

  'hero-03': {
    html: `<section class="hero">\n  <h1>Built for people who build</h1>\n  <p class="sub">Join 4,000 developers learning in the open.</p>\n  <button class="primary">Join free</button>\n  <div class="logos">\n    <span>ACME</span>\n    <span>GLOBEX</span>\n    <span>INITECH</span>\n  </div>\n</section>\n`,
    css: `.hero {
  width: 100%;
  height: 100%;
  padding: 56px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  background: #0f172a;
}
h1 {
  font-size: 48px;
  font-weight: 600;
  color: #f8fafc;
}
.sub {
  font-size: 18px;
  color: #94a3b8;
}
.primary {
  margin-top: 6px;
  padding: 12px 28px;
  border-radius: 8px;
  background: #f8fafc;
  color: #0f172a;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
.logos {
  margin-top: auto;
  display: flex;
  gap: 48px;
}
.logos span {
  font-size: 14px;
  font-weight: 600;
  color: #475569;
}
`,
  },

  'hero-04': {
    html: `<section class="hero">\n  <h1>The numbers so far</h1>\n  <p class="sub">Every one of them earned a pixel at a time.</p>\n  <div class="stats">\n    <div class="stat"><strong>4,281</strong><span>Learners</span></div>\n    <div class="stat"><strong>92%</strong><span>Finish rate</span></div>\n    <div class="stat"><strong>120k</strong><span>Submissions</span></div>\n  </div>\n</section>\n`,
    css: `.hero {
  width: 100%;
  height: 100%;
  padding: 64px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  background: #ffffff;
}
h1 {
  font-size: 44px;
  font-weight: 600;
  color: #0f172a;
}
.sub {
  font-size: 17px;
  color: #64748b;
}
.stats {
  margin-top: auto;
  width: 100%;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}
.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  border-left: 1px solid #e2e8f0;
}
.stat:first-child {
  border-left: none;
}
.stat strong {
  font-size: 36px;
  font-weight: 600;
  color: #0f172a;
}
.stat span {
  font-size: 14px;
  color: #64748b;
}
`,
  },

  // ── Calls to action ──────────────────────────────────────────────────────
  'cta-01': {
    html: `<section class="cta">\n  <div class="copy">\n    <h2>Ready to start?</h2>\n    <p>Your first challenge takes five minutes.</p>\n  </div>\n  <button class="primary">Start now</button>\n</section>\n`,
    css: `.cta {
  width: 100%;
  height: 100%;
  padding: 0 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #e0f2fe;
}
.copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
h2 {
  font-size: 34px;
  font-weight: 600;
  color: #0c4a6e;
}
.copy p {
  font-size: 16px;
  color: #0369a1;
}
.primary {
  padding: 14px 28px;
  border-radius: 8px;
  background: #0369a1;
  color: #ffffff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
`,
  },

  'cta-02': {
    html: `<section class="cta">\n  <h2>Get the weekly challenge</h2>\n  <p>One email. One build. Every Monday.</p>\n  <div class="form">\n    <div class="field">you@example.com</div>\n    <button class="primary">Subscribe</button>\n  </div>\n</section>\n`,
    css: `.cta {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: #f8fafc;
}
h2 {
  font-size: 32px;
  font-weight: 600;
  color: #0f172a;
}
.cta p {
  font-size: 16px;
  color: #64748b;
}
.form {
  margin-top: 12px;
  display: flex;
  gap: 8px;
}
.field {
  width: 280px;
  height: 44px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #ffffff;
  font-size: 15px;
  color: #94a3b8;
}
.primary {
  height: 44px;
  padding: 0 22px;
  border-radius: 8px;
  background: #0f172a;
  color: #f8fafc;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
`,
  },

  'cta-03': {
    html: `<section class="cta">\n  <div class="card">\n    <h2>Still deciding?</h2>\n    <p>Try one challenge. No account needed.</p>\n    <button class="ghost">Try a challenge</button>\n  </div>\n</section>\n`,
    css: `.cta {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
}
.card {
  width: 480px;
  padding: 36px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  background: #ffffff;
}
h2 {
  font-size: 28px;
  font-weight: 600;
  color: #0f172a;
}
.card p {
  font-size: 15px;
  color: #64748b;
}
.ghost {
  margin-top: 10px;
  padding: 12px 24px;
  border: 1px solid #0f172a;
  border-radius: 8px;
  background: #ffffff;
  color: #0f172a;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
`,
  },

  // ── Cards ────────────────────────────────────────────────────────────────
  'card-01': {
    html: `<article class="card">\n  <div class="thumb"></div>\n  <div class="body">\n    <h3>Mechanical Keyboard</h3>\n    <p class="price">$149</p>\n    <button class="primary">Add to cart</button>\n  </div>\n</article>\n`,
    css: `.card {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  background: #ffffff;
}
.thumb {
  height: 200px;
  background: #e2e8f0;
}
.body {
  flex: 1;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
h3 {
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
}
.price {
  font-size: 24px;
  font-weight: 600;
  color: #0f172a;
}
.primary {
  margin-top: auto;
  height: 44px;
  border-radius: 8px;
  background: #0f172a;
  color: #f8fafc;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
`,
  },

  'card-02': {
    html: `<article class="card">\n  <div class="avatar">FS</div>\n  <h3>Faisal Shohag</h3>\n  <p class="role">Instructor</p>\n  <div class="stats">\n    <div><strong>128</strong><span>Builds</span></div>\n    <div><strong>4.9</strong><span>Rating</span></div>\n  </div>\n</article>\n`,
    css: `.card {
  width: 100%;
  height: 100%;
  padding: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #ffffff;
}
.avatar {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: #0f172a;
  color: #f8fafc;
  font-size: 28px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
h3 {
  margin-top: 8px;
  font-size: 20px;
  font-weight: 600;
  color: #0f172a;
}
.role {
  font-size: 14px;
  color: #64748b;
}
.stats {
  margin-top: auto;
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
}
.stats div {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  border-left: 1px solid #e2e8f0;
}
.stats div:first-child {
  border-left: none;
}
.stats strong {
  font-size: 22px;
  font-weight: 600;
  color: #0f172a;
}
.stats span {
  font-size: 13px;
  color: #64748b;
}
`,
  },

  'card-03': {
    html: `<article class="card">\n  <span class="badge">Popular</span>\n  <h3>Pro</h3>\n  <p class="price">$12<span>/mo</span></p>\n  <ul class="features">\n    <li>Every challenge</li>\n    <li>Weekly leaderboard</li>\n    <li>Solution replays</li>\n  </ul>\n  <button class="primary">Choose Pro</button>\n</article>\n`,
    css: `.card {
  position: relative;
  width: 100%;
  height: 100%;
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 2px solid #0f172a;
  border-radius: 12px;
  background: #ffffff;
}
.badge {
  position: absolute;
  top: 16px;
  right: 16px;
  padding: 4px 10px;
  border-radius: 999px;
  background: #fef3c7;
  color: #92400e;
  font-size: 11px;
  font-weight: 600;
}
h3 {
  font-size: 18px;
  font-weight: 600;
  color: #64748b;
}
.price {
  font-size: 40px;
  font-weight: 600;
  color: #0f172a;
}
.price span {
  font-size: 15px;
  font-weight: 400;
  color: #64748b;
}
.features {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  list-style: none;
}
.features li {
  padding-left: 22px;
  position: relative;
  font-size: 14px;
  color: #334155;
}
.features li::before {
  content: "✓";
  position: absolute;
  left: 0;
  color: #16a34a;
  font-weight: 600;
}
.primary {
  margin-top: auto;
  height: 44px;
  border-radius: 8px;
  background: #0f172a;
  color: #f8fafc;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
`,
  },

  'card-04': {
    html: `<article class="card">\n  <div class="icon">!</div>\n  <div class="body">\n    <h3>Build failed</h3>\n    <p>Your last submission scored 61%. The header is 8px too tall.</p>\n    <span class="time">2 minutes ago</span>\n  </div>\n</article>\n`,
    css: `.card {
  width: 100%;
  height: 100%;
  padding: 24px;
  display: flex;
  gap: 16px;
  border: 1px solid #e2e8f0;
  border-left: 4px solid #dc2626;
  border-radius: 12px;
  background: #ffffff;
}
.icon {
  width: 40px;
  height: 40px;
  flex: none;
  border-radius: 8px;
  background: #fee2e2;
  color: #dc2626;
  font-size: 20px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
h3 {
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
}
.body p {
  font-size: 14px;
  line-height: 1.5;
  color: #64748b;
}
.time {
  margin-top: auto;
  align-self: flex-end;
  font-size: 12px;
  color: #94a3b8;
}
`,
  },

  // ── Footers ──────────────────────────────────────────────────────────────
  'footer-01': {
    html: `<footer class="foot">\n  <div class="cols">\n    <div class="col"><h4>Product</h4><a href="#">Labs</a><a href="#">Pricing</a></div>\n    <div class="col"><h4>Learn</h4><a href="#">Guides</a><a href="#">Blog</a></div>\n    <div class="col"><h4>Company</h4><a href="#">About</a><a href="#">Careers</a></div>\n    <div class="col"><h4>Legal</h4><a href="#">Terms</a><a href="#">Privacy</a></div>\n  </div>\n  <div class="base">© 2026 phi-lab</div>\n</footer>\n`,
    css: `.foot {
  width: 100%;
  height: 100%;
  padding: 40px 48px 0;
  display: flex;
  flex-direction: column;
  background: #f8fafc;
}
.cols {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 32px;
}
.col {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
h4 {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
}
.col a {
  font-size: 14px;
  color: #64748b;
}
.base {
  height: 56px;
  display: flex;
  align-items: center;
  border-top: 1px solid #e2e8f0;
  font-size: 13px;
  color: #94a3b8;
}
`,
  },

  'footer-02': {
    html: `<footer class="foot">\n  <div class="left">\n    <span class="logo">phi</span>\n    <span class="copy">© 2026 phi-lab</span>\n  </div>\n  <nav class="links">\n    <a href="#">Terms</a>\n    <a href="#">Privacy</a>\n    <a href="#">Contact</a>\n  </nav>\n</footer>\n`,
    css: `.foot {
  width: 100%;
  height: 100%;
  padding: 0 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #0f172a;
}
.left {
  display: flex;
  align-items: center;
  gap: 16px;
}
.logo {
  font-size: 20px;
  font-weight: 600;
  color: #f8fafc;
}
.copy {
  font-size: 13px;
  color: #64748b;
}
.links {
  display: flex;
  gap: 28px;
}
.links a {
  font-size: 14px;
  color: #94a3b8;
}
`,
  },

  'footer-03': {
    html: `<footer class="foot">\n  <div class="top">\n    <nav class="links">\n      <a href="#">Labs</a>\n      <a href="#">Hive</a>\n      <a href="#">Docs</a>\n    </nav>\n    <div class="signup">\n      <div class="field">you@example.com</div>\n      <button class="primary">Subscribe</button>\n    </div>\n  </div>\n  <div class="base">© 2026 phi-lab</div>\n</footer>\n`,
    css: `.foot {
  width: 100%;
  height: 100%;
  padding: 0 48px;
  display: flex;
  flex-direction: column;
  background: #ffffff;
}
.top {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.links {
  display: flex;
  gap: 28px;
}
.links a {
  font-size: 15px;
  color: #475569;
}
.signup {
  display: flex;
  gap: 8px;
}
.field {
  width: 240px;
  height: 42px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 14px;
  color: #94a3b8;
}
.primary {
  height: 42px;
  padding: 0 20px;
  border-radius: 8px;
  background: #0f172a;
  color: #f8fafc;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.base {
  height: 60px;
  display: flex;
  align-items: center;
  border-top: 1px solid #e2e8f0;
  font-size: 13px;
  color: #94a3b8;
}
`,
  },

  // ── Pricing ──────────────────────────────────────────────────────────────
  'pricing-01': {
    html: `<section class="plans">\n  <article class="plan"><h3>Free</h3><p class="price">$0</p><ul><li>Three challenges</li><li>Community</li></ul><button class="ghost">Start</button></article>\n  <article class="plan on"><h3>Pro</h3><p class="price">$12</p><ul><li>Everything</li><li>Leaderboard</li></ul><button class="primary">Choose Pro</button></article>\n  <article class="plan"><h3>Team</h3><p class="price">$40</p><ul><li>Seats</li><li>Reports</li></ul><button class="ghost">Contact</button></article>\n</section>\n`,
    css: `.plans {
  width: 100%;
  height: 100%;
  padding: 48px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  align-items: center;
  background: #f8fafc;
}
.plan {
  height: 380px;
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #ffffff;
}
.plan.on {
  height: 420px;
  border: 2px solid #0f172a;
}
h3 {
  font-size: 16px;
  font-weight: 600;
  color: #64748b;
}
.price {
  font-size: 40px;
  font-weight: 600;
  color: #0f172a;
}
ul {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  list-style: none;
}
li {
  font-size: 14px;
  color: #334155;
}
button {
  margin-top: auto;
  height: 44px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
.ghost {
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #0f172a;
}
.primary {
  background: #0f172a;
  color: #f8fafc;
}
`,
  },

  'pricing-02': {
    html: `<table class="cmp">\n  <thead>\n    <tr><th>Feature</th><th>Free</th><th>Pro</th></tr>\n  </thead>\n  <tbody>\n    <tr><td>Challenges</td><td>3</td><td>All</td></tr>\n    <tr><td>Leaderboard</td><td>No</td><td>Yes</td></tr>\n    <tr><td>Replays</td><td>No</td><td>Yes</td></tr>\n    <tr><td>Support</td><td>Community</td><td>Email</td></tr>\n  </tbody>\n</table>\n`,
    css: `.cmp {
  width: 100%;
  border-collapse: collapse;
  background: #ffffff;
}
th, td {
  height: 72px;
  padding: 0 32px;
  text-align: left;
  font-size: 15px;
}
th {
  background: #0f172a;
  color: #f8fafc;
  font-weight: 600;
}
td {
  color: #334155;
  border-bottom: 1px solid #e2e8f0;
}
tbody tr:nth-child(even) {
  background: #f8fafc;
}
`,
  },

  // ── Whole pages ──────────────────────────────────────────────────────────
  'page-01': {
    html: `<header class="bar">\n  <a class="logo" href="#">phi</a>\n  <nav class="links"><a href="#">Labs</a><a href="#">Pricing</a></nav>\n  <button class="cta">Sign in</button>\n</header>\n<section class="hero">\n  <h1>Learn the web by building it</h1>\n  <p>One pixel at a time.</p>\n  <button class="primary">Start building</button>\n</section>\n<section class="features">\n  <article class="feature"><h3>Build</h3><p>Write the markup.</p></article>\n  <article class="feature"><h3>Match</h3><p>Hit the target.</p></article>\n  <article class="feature"><h3>Climb</h3><p>Take the board.</p></article>\n</section>\n<section class="band">\n  <h2>Ready?</h2>\n  <button class="primary">Start now</button>\n</section>\n<footer class="foot">© 2026 phi-lab</footer>\n`,
    css: `#canvas {
  display: flex;
  flex-direction: column;
}
.bar {
  height: 72px;
  padding: 0 48px;
  display: flex;
  align-items: center;
  gap: 40px;
  border-bottom: 1px solid #e2e8f0;
}
.logo {
  font-size: 22px;
  font-weight: 600;
  color: #0f172a;
}
.bar .links {
  flex: 1;
  display: flex;
  gap: 28px;
}
.bar .links a {
  font-size: 15px;
  color: #475569;
}
.cta {
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
  cursor: pointer;
}
.hero {
  height: 520px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: #f8fafc;
}
.hero h1 {
  font-size: 52px;
  font-weight: 600;
  color: #0f172a;
}
.hero p {
  font-size: 18px;
  color: #64748b;
}
.primary {
  margin-top: 8px;
  padding: 13px 26px;
  border-radius: 8px;
  background: #0f172a;
  color: #f8fafc;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
.features {
  height: 420px;
  padding: 0 48px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  align-items: center;
}
.feature {
  height: 260px;
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}
.feature h3 {
  font-size: 20px;
  font-weight: 600;
  color: #0f172a;
}
.feature p {
  font-size: 15px;
  color: #64748b;
}
.band {
  height: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: #0f172a;
}
.band h2 {
  font-size: 38px;
  font-weight: 600;
  color: #f8fafc;
}
.band .primary {
  background: #f8fafc;
  color: #0f172a;
}
.foot {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-top: 1px solid #e2e8f0;
  font-size: 14px;
  color: #94a3b8;
}
`,
  },

  'page-02': {
    html: `<div class="shell">\n  <aside class="side">\n    <span class="logo">phi</span>\n    <nav><a class="on" href="#">Overview</a><a href="#">Builds</a><a href="#">Team</a></nav>\n  </aside>\n  <main class="main">\n    <header class="top"><h1>Overview</h1><div class="avatar">FS</div></header>\n    <section class="tiles">\n      <div class="tile"><span>Builds</span><strong>128</strong></div>\n      <div class="tile"><span>Match</span><strong>94%</strong></div>\n      <div class="tile"><span>Rank</span><strong>#7</strong></div>\n    </section>\n    <table class="rows">\n      <thead><tr><th>Challenge</th><th>Score</th></tr></thead>\n      <tbody>\n        <tr><td>Navbar 01</td><td>98%</td></tr>\n        <tr><td>Hero 02</td><td>91%</td></tr>\n        <tr><td>Card 03</td><td>87%</td></tr>\n      </tbody>\n    </table>\n  </main>\n</div>\n`,
    css: `.shell {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: 240px 1fr;
}
.side {
  padding: 28px 20px;
  display: flex;
  flex-direction: column;
  gap: 28px;
  background: #0f172a;
}
.logo {
  font-size: 22px;
  font-weight: 600;
  color: #f8fafc;
}
.side nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.side a {
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 14px;
  color: #94a3b8;
}
.side a.on {
  background: #1e293b;
  color: #f8fafc;
}
.main {
  display: flex;
  flex-direction: column;
  background: #f8fafc;
}
.top {
  height: 80px;
  padding: 0 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e2e8f0;
  background: #ffffff;
}
h1 {
  font-size: 24px;
  font-weight: 600;
  color: #0f172a;
}
.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #0f172a;
  color: #f8fafc;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tiles {
  padding: 32px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}
.tile {
  height: 110px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #ffffff;
}
.tile span {
  font-size: 13px;
  color: #64748b;
}
.tile strong {
  font-size: 30px;
  font-weight: 600;
  color: #0f172a;
}
.rows {
  margin: 0 32px;
  border-collapse: collapse;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}
.rows th, .rows td {
  height: 56px;
  padding: 0 20px;
  text-align: left;
  font-size: 14px;
}
.rows th {
  color: #64748b;
  font-weight: 600;
  border-bottom: 1px solid #e2e8f0;
}
.rows td {
  color: #334155;
  border-bottom: 1px solid #f1f5f9;
}
`,
  },
}

export function referenceFor(challengeId: string): ChallengeReference | undefined {
  return CHALLENGE_REFERENCES[challengeId]
}

/**
 * Catalog ids with no reference. Should always be empty — a challenge the arena
 * offers but nobody has proven solvable is a trap. Asserted in challenges.test.ts
 * rather than left to be discovered by a learner.
 */
export function challengesWithoutReference(): string[] {
  return ALL_CHALLENGES.filter((c) => !CHALLENGE_REFERENCES[c.id]).map((c) => c.id)
}
