// Prove every reference is achievable, deterministic, and correctly calibrated.
//
//   CHROME_PATH="/path/to/chrome" npx vite-node --config vitest.config.ts scripts/verify-references.ts
//   …    --write   also dumps the PNGs to pixel-targets/ for eyeballing
//
// This is the check the previous build could not write. It had no renderer of
// its own, so "does this reference actually score 100%?" could only be answered
// by a human pasting CSS into a browser, 27 times, and it never was — 25 of the
// 27 shipped unverified. Now that the scorer renders, the scorer can be asked.
//
// A reference that cannot score against its own render is broken by definition,
// and it fails the learner who is *right*. That is the worst bug this lab can
// have, which is why this exists.
//
// It checks four things per challenge:
//   1. Renders at the challenge's exact canvas. A wrong size is a diff that
//      throws rather than a score.
//   2. Is not blank. A blank target is one every empty submission matches.
//   3. Renders byte-identically twice. Catches nondeterminism — an unfrozen
//      animation, a font that had not settled — which would show up in
//      production as one learner's score wobbling for no reason.
//   4. Scores exactly 1.0 through the real scoring path — and, just as load
//      bearing, that an *empty editor* scores 0 and earns nothing against it.
//      That is not hypothetical: a 2%-ink hero is 98.9% "matched" by a blank
//      canvas, and an earlier build paid 16 XP for exactly that.

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { PNG } from 'pngjs'

import { ALL_CHALLENGES } from '@/lib/pixel/challenges'
import { referenceFor, isRenderedReference } from '@/lib/pixel/challenges-expected'
import { diffImages } from '@/lib/pixel/diff'
import { renderToPng } from '@/lib/pixel/render'
import { scoreFrom, tiersFor } from '@/lib/pixel/score'

const write = process.argv.includes('--write')
const OUT = join(process.cwd(), 'pixel-targets')

function inkPercent(png: PNG): number {
  let ink = 0
  for (let i = 0; i < png.data.length; i += 4) {
    if (png.data[i] !== 255 || png.data[i + 1] !== 255 || png.data[i + 2] !== 255) ink++
  }
  return (ink / (png.width * png.height)) * 100
}

if (write) await mkdir(OUT, { recursive: true })

const failures: string[] = []

console.log('id            canvas       ink%   deterministic  reference  empty editor')
console.log('─'.repeat(84))

for (const challenge of ALL_CHALLENGES) {
  const reference = referenceFor(challenge.id)
  if (!reference || !isRenderedReference(reference)) {
    failures.push(`${challenge.id}: no rendered reference`)
    continue
  }

  const { width, height } = challenge.canvas
  let row = challenge.id.padEnd(14)

  try {
    const first = await renderToPng(reference, challenge.canvas)
    const second = await renderToPng(reference, challenge.canvas)
    const png = PNG.sync.read(first)

    row += `${width}x${height}`.padEnd(13)

    if (png.width !== width || png.height !== height) {
      failures.push(`${challenge.id}: rendered ${png.width}x${png.height}, wanted ${width}x${height}`)
      console.log(`${row}RENDERED AT THE WRONG SIZE`)
      continue
    }

    const ink = inkPercent(png)
    row += `${ink.toFixed(2).padStart(6)}  `

    if (ink < 0.05) {
      failures.push(`${challenge.id}: target is blank (${ink.toFixed(3)}% ink)`)
    }

    const deterministic = first.equals(second)
    row += `${deterministic ? 'yes' : 'NO'}`.padEnd(15)
    if (!deterministic) {
      failures.push(`${challenge.id}: two renders of the same source differ — something is animating`)
    }

    // The real scoring path, on the real bytes: the reference must be worth full
    // marks, or this challenge fails the learner who is right.
    const other = PNG.sync.read(second)
    const raw = diffImages(new Uint8Array(png.data), new Uint8Array(other.data), width, height)
    const score = scoreFrom(raw.diffPixels, raw.unionPixels)
    row += `${(score * 100).toFixed(1)}%`.padStart(9) + '  '
    if (score !== 1) {
      failures.push(`${challenge.id}: reference scores ${score}, not 1`)
    }

    // And an empty editor must be worth nothing. This is the bug that shipped
    // last time: on a 2%-ink hero, doing nothing scored 98.9% and was paid for it.
    const blank = PNG.sync.read(await renderToPng({ html: '', css: '' }, challenge.canvas))
    const blankDiff = diffImages(new Uint8Array(blank.data), new Uint8Array(png.data), width, height)
    const emptyScore = scoreFrom(blankDiff.diffPixels, blankDiff.unionPixels)
    const emptyTiers = tiersFor(emptyScore)
    row += `${(emptyScore * 100).toFixed(1)}%${emptyTiers.length > 0 ? ` PAID ${emptyTiers.join('+')}` : ''}`
    if (emptyTiers.length > 0) {
      failures.push(`${challenge.id}: an empty editor earns ${emptyTiers.join(', ')}`)
    }

    console.log(row)

    if (write) await writeFile(join(OUT, `${challenge.id}.png`), first)
  } catch (err) {
    console.log(`${row}RENDER FAILED`)
    failures.push(`${challenge.id}: ${err instanceof Error ? err.message : String(err)}`)
  }
}

console.log('─'.repeat(84))

if (failures.length > 0) {
  console.log(`\n${failures.length} FAILED:`)
  for (const line of failures) console.log(`  ${line}`)
  process.exit(1)
}

console.log(
  `\nAll ${ALL_CHALLENGES.length} references render, are deterministic, score exactly 100%,\n` +
    `and an empty editor scores 0% and earns nothing on every one of them.`,
)
process.exit(0)
