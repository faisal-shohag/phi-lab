import { describe, expect, it } from 'vitest'

import { ALL_CHALLENGES } from '../challenges'
import {
  crossedMilestone,
  isCleared,
  isMilestone,
  isUnlocked,
  newlyUnlocked,
  nextChallengeId,
  topicOpenedBy,
  unlockStates,
  type TiersByChallenge,
} from '../unlock'
import type { Tier } from '../score'

const FIRST = ALL_CHALLENGES[0].id
const SECOND = ALL_CHALLENGES[1].id
const THIRD = ALL_CHALLENGES[2].id

/** Tiers are cumulative in real life, so build them that way here too. */
function tiers(...pairs: Array<[string, Tier]>): TiersByChallenge {
  const out: TiersByChallenge = {}
  for (const [id, tier] of pairs) {
    const all: Tier[] = tier === 'perfect' ? ['standing', 'close', 'perfect'] : tier === 'close' ? ['standing', 'close'] : ['standing']
    out[id] = all
  }
  return out
}

describe('unlockStates', () => {
  it('opens the first challenge to someone who has done nothing', () => {
    // Including a signed-out visitor, whose progress fetch 401s and who is
    // therefore indistinguishable from a new learner here.
    const states = unlockStates({})
    expect(states[FIRST]).toBe('available')
  })

  it('shuts everything else to someone who has done nothing', () => {
    const states = unlockStates({})
    const open = ALL_CHALLENGES.filter((c) => states[c.id] !== 'locked')
    expect(open.map((c) => c.id)).toEqual([FIRST])
  })

  it('opens the next one once the previous is cleared', () => {
    const states = unlockStates(tiers([FIRST, 'standing']))
    expect(states[FIRST]).toBe('cleared')
    expect(states[SECOND]).toBe('available')
    expect(states[THIRD]).toBe('locked')
  })

  it('clears at Standing, not at Pixel perfect', () => {
    // The whole point of the bar: 99.5% would wall a learner out of 26
    // challenges over one stubborn pixel.
    expect(unlockStates(tiers([FIRST, 'standing']))[SECOND]).toBe('available')
  })

  it('marks a perfected challenge perfect rather than merely cleared', () => {
    expect(unlockStates(tiers([FIRST, 'perfect']))[FIRST]).toBe('perfect')
  })

  it('still opens the next one from a perfect', () => {
    expect(unlockStates(tiers([FIRST, 'perfect']))[SECOND]).toBe('available')
  })

  // The bug this guards: if "unlocked" cascaded off `state !== 'locked'` rather
  // than off *cleared*, reaching a challenge would open every challenge after it
  // and the whole run would fall open at once.
  it('does not let an untouched-but-open challenge open the one after it', () => {
    const states = unlockStates(tiers([FIRST, 'standing']))
    expect(states[SECOND]).toBe('available')
    expect(states[THIRD]).toBe('locked')
  })

  it('walks the run forward one at a time', () => {
    const states = unlockStates(tiers([FIRST, 'standing'], [SECOND, 'close']))
    expect(states[SECOND]).toBe('cleared')
    expect(states[THIRD]).toBe('available')
  })

  it('gives every challenge in the catalog a state', () => {
    const states = unlockStates({})
    expect(Object.keys(states).sort()).toEqual(ALL_CHALLENGES.map((c) => c.id).sort())
  })

  it('ignores receipts for challenges that no longer exist', () => {
    expect(() => unlockStates({ 'retired-99': ['standing'] })).not.toThrow()
    expect(unlockStates({ 'retired-99': ['standing'] })[FIRST]).toBe('available')
  })
})

describe('isCleared / isUnlocked', () => {
  it('treats Standing as cleared and anything less as not', () => {
    expect(isCleared(tiers([FIRST, 'standing']), FIRST)).toBe(true)
    expect(isCleared({}, FIRST)).toBe(false)
  })

  it('is the gate the server asks', () => {
    expect(isUnlocked({}, FIRST)).toBe(true)
    expect(isUnlocked({}, SECOND)).toBe(false)
    expect(isUnlocked(tiers([FIRST, 'standing']), SECOND)).toBe(true)
  })
})

describe('nextChallengeId', () => {
  it('points at the first thing to do', () => {
    expect(nextChallengeId({})).toBe(FIRST)
  })

  it('follows the learner forward', () => {
    expect(nextChallengeId(tiers([FIRST, 'standing']))).toBe(SECOND)
  })

  it('points at the last challenge once the whole run is cleared, rather than nowhere', () => {
    const everything = tiers(...ALL_CHALLENGES.map((c) => [c.id, 'perfect'] as [string, Tier]))
    expect(nextChallengeId(everything)).toBe(ALL_CHALLENGES[ALL_CHALLENGES.length - 1].id)
  })
})

describe('newlyUnlocked', () => {
  it('reports the crossing, not the state', () => {
    const before = {}
    const after = tiers([FIRST, 'standing'])
    expect(newlyUnlocked(before, after)).toEqual([SECOND])
  })

  it('says nothing when nothing opened', () => {
    // Improving Standing to Perfect on a challenge already cleared opens nothing
    // new — and must not fire the unlock sound a second time.
    const before = tiers([FIRST, 'standing'])
    const after = tiers([FIRST, 'perfect'])
    expect(newlyUnlocked(before, after)).toEqual([])
  })

  it('fires once for one submission, even though tiers are cumulative', () => {
    // A single submit can bank standing+close+perfect at once. That is one
    // opening, not three.
    expect(newlyUnlocked({}, tiers([FIRST, 'perfect']))).toEqual([SECOND])
  })

  it('says nothing on a re-score', () => {
    const same = tiers([FIRST, 'standing'])
    expect(newlyUnlocked(same, same)).toEqual([])
  })
})

describe('milestones', () => {
  it('marks the last challenge of a topic', () => {
    const lastOfFirstTopic = [...ALL_CHALLENGES].filter((c) => c.topicId === ALL_CHALLENGES[0].topicId).pop()!
    expect(isMilestone(lastOfFirstTopic.id)).toBe(true)
  })

  it('does not mark a challenge in the middle of a topic', () => {
    expect(isMilestone(FIRST)).toBe(false)
  })

  it('does not mark the very last challenge — it opens nothing', () => {
    const last = ALL_CHALLENGES[ALL_CHALLENGES.length - 1]
    expect(isMilestone(last.id)).toBe(false)
    expect(topicOpenedBy(last.id)).toBeNull()
  })

  it('names the topic a milestone opens', () => {
    const lastOfFirstTopic = [...ALL_CHALLENGES].filter((c) => c.topicId === ALL_CHALLENGES[0].topicId).pop()!
    expect(topicOpenedBy(lastOfFirstTopic.id)).toBe(ALL_CHALLENGES[1 + ALL_CHALLENGES.indexOf(lastOfFirstTopic)].topicId)
  })

  it('has one milestone per topic boundary, derived from the catalog rather than declared', () => {
    const topics = new Set(ALL_CHALLENGES.map((c) => c.topicId))
    expect(ALL_CHALLENGES.filter((c) => isMilestone(c.id))).toHaveLength(topics.size - 1)
  })

  it('detects an unlock that crossed into a new topic', () => {
    const firstTopic = ALL_CHALLENGES[0].topicId
    const firstOfNextTopic = ALL_CHALLENGES.find((c) => c.topicId !== firstTopic)!
    expect(crossedMilestone([firstOfNextTopic.id])).toBe(firstOfNextTopic.topicId)
  })

  it('does not call an ordinary unlock a milestone', () => {
    expect(crossedMilestone([SECOND])).toBeNull()
  })
})
