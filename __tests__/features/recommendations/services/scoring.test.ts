import { describe, expect, it } from 'vitest'
import {
  batchAnchors,
  mergeSignals,
  resolveWindowStart,
  truncateByAnchor,
  type ScoredPair,
  type SignalPair,
} from '@/features/recommendations/services/scoring'
import {
  AFFINITY_WINDOW_DAYS,
  MAX_PAIRS_PER_ANCHOR,
  SIGNAL_WEIGHTS,
} from '@/features/recommendations/constants'

const pair = (
  anchorProductId: string,
  recommendedProductId: string,
  support: number
): SignalPair => ({ anchorProductId, recommendedProductId, support })

const emptySignals = { purchase: [], wishlist: [], share: [] }

describe('resolveWindowStart', () => {
  it('bounds the window to the configured number of days', () => {
    const now = new Date('2026-08-08T00:00:00.000Z')

    const start = resolveWindowStart(AFFINITY_WINDOW_DAYS, now)

    const elapsedDays = (now.getTime() - start.getTime()) / 86_400_000
    expect(elapsedDays).toBe(AFFINITY_WINDOW_DAYS)
  })

  it('honours an override so an operator can widen a cold catalog', () => {
    const now = new Date('2026-08-08T00:00:00.000Z')

    const start = resolveWindowStart(30, now)

    expect(start.toISOString()).toBe('2026-07-09T00:00:00.000Z')
  })

  it('returns the same boundary for the same inputs, so a retry is stable', () => {
    const now = new Date('2026-08-08T12:34:56.789Z')

    expect(resolveWindowStart(90, now).toISOString()).toBe(
      resolveWindowStart(90, now).toISOString()
    )
  })
})

describe('mergeSignals', () => {
  it('weights a purchase above a wishlist above a share', () => {
    const merged = mergeSignals({
      purchase: [pair('aaaaaaa', 'bbbbbbb', 4)],
      wishlist: [pair('aaaaaaa', 'ccccccc', 4)],
      share: [pair('aaaaaaa', 'ddddddd', 4)],
    })

    const byId = new Map(merged.map((m) => [m.recommendedProductId, m.score]))
    expect(byId.get('bbbbbbb')).toBeGreaterThan(byId.get('ccccccc') as number)
    expect(byId.get('ccccccc')).toBeGreaterThan(byId.get('ddddddd') as number)
  })

  it('applies the documented weight to the support count', () => {
    const merged = mergeSignals({
      ...emptySignals,
      wishlist: [pair('aaaaaaa', 'bbbbbbb', 6)],
    })

    expect(merged[0].score).toBe(6 * SIGNAL_WEIGHTS.wishlist)
  })

  it('sums contributions when several signals back the same pair', () => {
    const merged = mergeSignals({
      purchase: [pair('aaaaaaa', 'bbbbbbb', 3)],
      wishlist: [pair('aaaaaaa', 'bbbbbbb', 4)],
      share: [],
    })

    expect(merged).toHaveLength(1)
    expect(merged[0].score).toBe(
      3 * SIGNAL_WEIGHTS.purchase + 4 * SIGNAL_WEIGHTS.wishlist
    )
  })

  it('reports the strongest single contributor as the source', () => {
    const merged = mergeSignals({
      ...emptySignals,
      share: [pair('aaaaaaa', 'bbbbbbb', 9)],
    })

    expect(merged[0].source).toBe('share')
  })

  it('reports "combined" when more than one signal contributed', () => {
    const merged = mergeSignals({
      purchase: [pair('aaaaaaa', 'bbbbbbb', 3)],
      wishlist: [pair('aaaaaaa', 'bbbbbbb', 3)],
      share: [],
    })

    expect(merged[0].source).toBe('combined')
  })

  it('takes the maximum support rather than the sum, because the signals count different things', () => {
    const merged = mergeSignals({
      purchase: [pair('aaaaaaa', 'bbbbbbb', 3)],
      wishlist: [pair('aaaaaaa', 'bbbbbbb', 7)],
      share: [],
    })

    expect(merged[0].support).toBe(7)
  })

  it('never emits a self-referencing pair', () => {
    const merged = mergeSignals({
      ...emptySignals,
      purchase: [pair('aaaaaaa', 'aaaaaaa', 10)],
    })

    expect(merged).toEqual([])
  })

  it('treats the association as directed', () => {
    const merged = mergeSignals({
      ...emptySignals,
      purchase: [pair('aaaaaaa', 'bbbbbbb', 5), pair('bbbbbbb', 'aaaaaaa', 2)],
    })

    const forward = merged.find((m) => m.anchorProductId === 'aaaaaaa')
    const reverse = merged.find((m) => m.anchorProductId === 'bbbbbbb')
    expect(forward?.score).not.toBe(reverse?.score)
  })
})

describe('truncateByAnchor', () => {
  const scored = (recommendedProductId: string, score: number): ScoredPair => ({
    anchorProductId: 'aaaaaaa',
    recommendedProductId,
    score,
    support: 3,
    source: 'purchase',
  })

  it('keeps at most MAX_PAIRS_PER_ANCHOR rows per anchor', () => {
    const pairs = Array.from({ length: MAX_PAIRS_PER_ANCHOR + 10 }, (_, i) =>
      scored(`p${String(i).padStart(6, '0')}`, i)
    )

    const result = truncateByAnchor(pairs)

    expect(result.get('aaaaaaa')).toHaveLength(MAX_PAIRS_PER_ANCHOR)
  })

  it('keeps the strongest associations, not the first seen', () => {
    const pairs = Array.from({ length: MAX_PAIRS_PER_ANCHOR + 1 }, (_, i) =>
      scored(`p${String(i).padStart(6, '0')}`, i)
    )

    const kept = truncateByAnchor(pairs).get('aaaaaaa') ?? []

    expect(kept[0].score).toBe(MAX_PAIRS_PER_ANCHOR)
    expect(kept.map((k) => k.recommendedProductId)).not.toContain('p000000')
  })

  it('breaks ties deterministically so a re-run produces identical rows', () => {
    const pairs = [scored('zzzzzzz', 5), scored('aaaaaab', 5)]

    const first = truncateByAnchor(pairs).get('aaaaaaa')
    const second = truncateByAnchor([...pairs].reverse()).get('aaaaaaa')

    expect(first?.map((p) => p.recommendedProductId)).toEqual(
      second?.map((p) => p.recommendedProductId)
    )
  })

  it('groups independently per anchor', () => {
    const result = truncateByAnchor([
      scored('bbbbbbb', 1),
      { ...scored('ccccccc', 1), anchorProductId: 'ddddddd' },
    ])

    expect([...result.keys()].sort()).toEqual(['aaaaaaa', 'ddddddd'])
  })
})

describe('batchAnchors', () => {
  it('splits anchors into fixed-size batches', () => {
    expect(batchAnchors(['a', 'b', 'c', 'd', 'e'], 2)).toEqual([
      ['a', 'b'],
      ['c', 'd'],
      ['e'],
    ])
  })

  it('returns no batches for an empty anchor set', () => {
    expect(batchAnchors([], 10)).toEqual([])
  })

  it('covers every anchor exactly once', () => {
    const anchors = Array.from({ length: 57 }, (_, i) => `a${i}`)

    const flattened = batchAnchors(anchors, 10).flat()

    expect(flattened).toEqual(anchors)
  })
})
