import { describe, expect, it } from 'vitest'

import { buildSrcdoc } from '../harness'

const CANVAS = { width: 1280, height: 72 }
const FONT = "@font-face { font-family: 'PixelLabSans'; src: url(data:font/woff2;base64,AAAA) format('woff2'); }"

function doc(over: Partial<Parameters<typeof buildSrcdoc>[0]> = {}) {
  return buildSrcdoc({
    source: { html: '<div class="bar">hi</div>', css: '.bar { color: red; }' },
    canvas: CANVAS,
    fontFace: FONT,
    ...over,
  })
}

describe('buildSrcdoc', () => {
  it('sizes #canvas to the challenge, which is what makes the diff comparable', () => {
    const html = doc()
    expect(html).toContain('width: 1280px')
    expect(html).toContain('height: 72px')
    expect(html).toContain('id="canvas"')
  })

  it('puts the learner CSS after the reset, so their rules win', () => {
    const html = doc({ source: { html: '<i></i>', css: '.mine { color: blue; }' } })
    expect(html.indexOf('box-sizing')).toBeLessThan(html.indexOf('.mine'))
  })

  it('puts the font before the reset that uses it', () => {
    const html = doc()
    expect(html.indexOf('@font-face')).toBeLessThan(html.indexOf('font-family'))
  })

  // Without this a learner's own animation makes their score depend on the
  // microsecond the screenshot fired — the same code scoring 94% then 71%.
  it('freezes animation after the learner CSS, so a score cannot depend on timing', () => {
    const html = doc({ source: { html: '<i></i>', css: '.mine { animation: spin 1s infinite; }' } })
    expect(html).toContain('animation: none !important')
    expect(html.indexOf('.mine')).toBeLessThan(html.indexOf('animation: none !important'))
  })
})

describe('the CSP', () => {
  it('blocks the network', () => {
    expect(doc()).toContain("default-src 'none'")
  })

  it('allows exactly what the render needs and nothing else', () => {
    const csp = doc().match(/Content-Security-Policy" content="([^"]+)"/)?.[1]
    expect(csp).toBe("default-src 'none'; style-src 'unsafe-inline'; font-src data:;")
  })

  // The one that matters most. The target is served to every signed-in learner —
  // it is the picture they are matching — so if images were allowed at all, they
  // could base64 it and paste `<img src="data:image/png;base64,…">` for a
  // guaranteed 100% on every challenge. The size caps do not help: a navbar PNG
  // base64s to ~13KB, well under the 20,000 limit. This is why Pixel Lab is pure
  // CSS, and why no challenge may ever ship an <img>, an SVG, or a
  // background-image.
  it('permits no images, which is the only thing that stops the target being pasted back', () => {
    const html = doc({
      source: { html: '<img src="data:image/png;base64,AAAA">', css: 'body { background-image: url(data:image/png;base64,AAAA); }' },
    })
    expect(html).not.toContain('img-src')
  })

  // Scripts are blocked in the *document*, so the preview and the scored render
  // agree. A preview that runs code the scorer will not is a page the learner is
  // shown but not graded on.
  it('permits no scripts', () => {
    expect(doc({ source: { html: '<script>alert(1)</script>', css: '' } })).not.toContain('script-src')
  })

  // snapdom used to fetch() the data: URI it inlined. It is gone, and so is the
  // only reason this was ever open.
  it('permits no connections', () => {
    expect(doc()).not.toContain('connect-src')
  })

  it('never grants same-origin — that pairing is a sandbox escape', () => {
    // Guarded here because the srcdoc is where it would be tempting to add it.
    expect(doc()).not.toContain('allow-same-origin')
  })
})

describe('payload bounds', () => {
  it('truncates a payload rather than embedding an unbounded one', () => {
    const html = doc({ source: { html: 'a'.repeat(50_000), css: '' } })
    expect(html.length).toBeLessThan(45_000)
  })

  it('truncates html and css independently', () => {
    // Rare glyphs, because the boilerplate around them is full of ordinary ones.
    const html = doc({ source: { html: 'ф'.repeat(50_000), css: 'ж'.repeat(50_000) } })
    expect(html.split('ф').length - 1).toBe(20_000)
    expect(html.split('ж').length - 1).toBe(20_000)
  })
})
