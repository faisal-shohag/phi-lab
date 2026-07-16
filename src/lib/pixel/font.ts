// The sandbox's one and only font.
//
// Pure and shared: the client builds an @font-face for the preview, the server
// builds one for the scored render, and they must be byte-identical or the
// learner is scored against something they never saw. Each side supplies the
// base64 its own way — fetch in the browser, fs on the server — and this is the
// single place that decides what the resulting CSS looks like.

/** The family name the sandbox reset uses. Arbitrary, but must match harness.ts. */
export const FONT_FAMILY = 'PixelLabSans'

/**
 * The font, as a `data:` URI @font-face block.
 *
 * `data:` rather than a URL for two reasons that arrive from opposite
 * directions: the preview frame has an opaque origin and no CORS to satisfy,
 * and the render Chromium has no network and no system fonts at all. One
 * inlined face answers both. Also why the CSP allows `font-src data:` and
 * nothing else.
 *
 * The font is the fairness fix for the entire lab: scores are pixel diffs and
 * UI sections are mostly text, so a face that differs between the two sides of
 * the diff costs the learner points for nothing they did.
 */
export function fontFaceCss(base64: string): string {
  return `@font-face {
  font-family: '${FONT_FAMILY}';
  font-style: normal;
  font-weight: 400 600;
  font-display: block;
  src: url(data:font/woff2;base64,${base64}) format('woff2');
}`
}
