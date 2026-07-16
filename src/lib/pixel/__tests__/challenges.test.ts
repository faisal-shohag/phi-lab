// Catalog integrity. These are the mistakes that are cheap to make while
// authoring and expensive to discover as a learner: a challenge nobody can
// score, a target that leaks, a canvas nobody can hit.

import { describe, expect, it } from 'vitest'

import {
  ALL_CHALLENGES,
  CHALLENGE_BY_ID,
  PIXEL_TOPICS,
  TOPIC_IDS,
  TOTAL_CHALLENGES,
} from '../challenges'
import { CHALLENGE_REFERENCES, challengesWithoutReference, isRenderedReference } from '../challenges-expected'

describe('the catalog', () => {
  it('gives every challenge a unique id', () => {
    const ids = ALL_CHALLENGES.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('uses ids that are safe as filenames', () => {
    // targets.ts turns these into paths. Anything outside this set is either a
    // traversal or a file nobody can open.
    for (const c of ALL_CHALLENGES) {
      expect(c.id, c.id).toMatch(/^[a-z0-9-]+$/)
    }
  })

  it('files every challenge under a real topic, matching its own topicId', () => {
    for (const topic of PIXEL_TOPICS) {
      expect(TOPIC_IDS).toContain(topic.id)
      for (const challenge of topic.challenges) {
        expect(challenge.topicId).toBe(topic.id)
      }
    }
  })

  it('keeps the derived exports in step with the topics', () => {
    expect(TOTAL_CHALLENGES).toBe(ALL_CHALLENGES.length)
    expect(Object.keys(CHALLENGE_BY_ID)).toHaveLength(TOTAL_CHALLENGES)
  })

  it('gives every challenge a positive canvas', () => {
    for (const c of ALL_CHALLENGES) {
      expect(c.canvas.width, `${c.id} width`).toBeGreaterThan(0)
      expect(c.canvas.height, `${c.id} height`).toBeGreaterThan(0)
    }
  })

  it('gives every challenge a brief and starter markup', () => {
    for (const c of ALL_CHALLENGES) {
      expect(c.brief.length, `${c.id} brief`).toBeGreaterThan(20)
      expect(c.starterHtml.trim(), `${c.id} starter html`).not.toBe('')
    }
  })

  // This used to police a per-challenge `perfectAt`, hand-tuned on twelve of
  // these from each target's ink density. The score is now measured from what a
  // blank canvas gets (lib/pixel/score.ts), which fixes every tier at once and
  // needs no per-challenge knob, so there is nothing here left to keep sane.
  it('carries no per-challenge scoring knobs', () => {
    for (const c of ALL_CHALLENGES) {
      expect(c, `${c.id}`).not.toHaveProperty('perfectAt')
    }
  })
})

// The one that matters most. `brief` exists because a target you have never seen
// cannot be submitted back — that is the entire premise of the kind. A targetPng
// on a brief challenge would ship the answer to the browser and quietly destroy it.
describe('target exposure', () => {
  it('never gives a brief challenge a target URL', () => {
    for (const c of ALL_CHALLENGES) {
      if (c.kind !== 'brief') continue
      expect(c.targetPng, `${c.id} must not expose a target`).toBeUndefined()
    }
  })

  it('gives every match and page challenge a target URL', () => {
    for (const c of ALL_CHALLENGES) {
      if (c.kind === 'brief') continue
      expect(c.targetPng, `${c.id} needs a target to reproduce`).toBeTruthy()
    }
  })

  it('routes targets rather than serving them from public/', () => {
    // A file in public/ is readable by anyone who guesses the URL, and the id is
    // right there in the catalog. The route is what enforces the brief rule.
    for (const c of ALL_CHALLENGES) {
      if (!c.targetPng) continue
      expect(c.targetPng, c.id).toBe(`/api/labs/pixel-lab/target/${c.id}`)
    }
  })

  it('spells the brief out precisely enough to hit without a picture', () => {
    for (const c of ALL_CHALLENGES) {
      if (c.kind !== 'brief') continue
      // A design brief cannot be diffed — there has to be one right render. The
      // proxy for that is dimensions and a colour, which every spec here carries.
      expect(c.brief, `${c.id}`).toMatch(/\d+\s*(px|x\s*\d+)/i)
      expect(c.brief, `${c.id}`).toMatch(/#[0-9a-f]{3,6}/i)
    }
  })
})

describe('the references', () => {
  it('covers every challenge the arena offers', () => {
    // A challenge nobody has proven solvable is a trap, and it is also
    // ungenerable: no reference, no target, no score.
    expect(challengesWithoutReference()).toEqual([])
  })

  it('has no references for challenges that no longer exist', () => {
    const known = new Set(ALL_CHALLENGES.map((c) => c.id))
    expect(Object.keys(CHALLENGE_REFERENCES).filter((id) => !known.has(id))).toEqual([])
  })

  it('gives every reference both halves', () => {
    for (const c of ALL_CHALLENGES) {
      const ref = CHALLENGE_REFERENCES[c.id]
      if (!isRenderedReference(ref)) throw new Error(`${c.id} is file-backed — see below`)
      expect(ref.html.trim(), `${c.id} reference html`).not.toBe('')
      expect(ref.css.trim(), `${c.id} reference css`).not.toBe('')
    }
  })

  it('starts the learner from the same markup the reference uses', () => {
    // The lab is about CSS. Handing over different markup than the reference was
    // written against would make the target unreachable for reasons the brief
    // never mentions.
    for (const c of ALL_CHALLENGES) {
      const ref = CHALLENGE_REFERENCES[c.id]
      if (!isRenderedReference(ref)) continue
      expect(ref.html.trim(), `${c.id}`).toBe(c.starterHtml.trim())
    }
  })

  // The escape hatch exists so designer art *could* land; nothing should walk
  // through it casually. A file-backed target is not produced by the learner's
  // renderer, so nobody can reach 1.0 against it — it would need its own lowered
  // bar, and calling that "Pixel perfect" would be a lie on the one lab whose
  // point is that the score is honest. If this test ever fails, that whole
  // argument is what needs answering, not this line.
  it('renders every target from code, with no designer PNGs anywhere', () => {
    const fileBacked = ALL_CHALLENGES.filter((c) => !isRenderedReference(CHALLENGE_REFERENCES[c.id]))
    expect(fileBacked.map((c) => c.id)).toEqual([])
  })
})
