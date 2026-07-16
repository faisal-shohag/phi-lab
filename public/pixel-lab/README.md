# public/pixel-lab

| File | What | Committed? |
|---|---|---|
| `geist-latin.woff2` | Geist, latin subset, variable `font-weight: 400 600`. The sandbox font. | yes |
| `map-backdrop.webp` | The terrain behind the run (`components/pixel/challenge-map.tsx`). 1280², ~258KB. | yes |
| `map-bg.webp` | The 1920² source `map-backdrop.webp` was made from. **Unused at runtime.** | yes |

## The map backdrop

Downscaled from `map-bg.webp` (1920², 605KB) with:

```sh
ffmpeg -i map-bg.webp -vf "scale=1280:1280:flags=lanczos" -c:v libwebp -quality 72 map-backdrop.webp
```

1280 rather than the full 1920 because the board renders at most ~900 CSS px wide and the art sits under
a heavy scrim — nothing survives of the extra detail, and 347KB is a lot to spend on a backdrop for
learners on mobile. Keep the source around if it ever needs re-cutting at a different aspect.

**It does not conflict with the lab's no-images rule.** That rule is about the *sandbox* CSP
(`lib/pixel/harness.ts`), which forbids images inside the frame a learner's CSS renders in — the thing
that stops them pasting the target back for a free 100%. This is our own UI, outside the sandbox
entirely.

## Why the font is here rather than imported

The sandbox is `sandbox=""` under a `default-src 'none'` CSP — it can load nothing by URL, and its
opaque origin cannot reach ours. So the font is inlined into the document as a `data:` URI instead.
Both sides do this and must produce identical CSS, so both go through `fontFaceCss()` in
`src/lib/pixel/font.ts`:

- **the preview**, in the learner's browser, fetches this file (`src/lib/pixel/assets.ts`);
- **the scored render**, in a headless Chromium, reads it off disk (`src/lib/pixel/render.ts`), which
  is what `outputFileTracingIncludes` in `next.config.ts` is for — the path is opened rather than
  imported, so the tracer cannot find it alone, and without that entry text renders as blank boxes in
  production only.

The render Chromium has **no system fonts at all**, so on that side this is not a nicety — it is the
only thing there is to render text with.

## Why it is committed rather than vendored at install time

It was copied once from `next/dist/next-devtools/server/font/geist-latin.woff2`. That path is a Next
internal: copying it on `postinstall` would break silently on a Next upgrade, and a font that changes
silently re-scores every challenge in the lab at once.

Geist is licensed SIL OFL 1.1 — <https://github.com/vercel/geist-font>. Redistribution is permitted
with attribution; this note is the attribution.

## Where the targets went

There are none. A target is a *render of the reference* in `src/lib/pixel/challenges-expected.ts`,
produced on demand and memoised per process (`src/lib/pixel/target.ts`). Both sides of every diff come
out of one browser in one invocation, so a correct answer lands on exactly 1.0 and no stored picture
can drift from the code that made it.

To eyeball them, or to check a reference you just edited:

```sh
CHROME_PATH="/path/to/chrome" npx vite-node --config vitest.config.ts scripts/verify-references.ts --write
```

`CHROME_PATH` is needed in development only: production renders with the Linux binary from
`@sparticuz/chromium`, which will not run on a dev machine. The binaries differ and it does not
matter — both sides of any one diff always come from the same one.
