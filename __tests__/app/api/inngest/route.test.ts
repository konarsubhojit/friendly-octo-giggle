import { afterEach, describe, it, expect, vi } from 'vitest'

const { mockGetFeatureFlags, mockHandler, mockServe } = vi.hoisted(() => ({
  mockGetFeatureFlags: vi.fn(),
  mockHandler: vi.fn(() => Promise.resolve(new Response())),
  mockServe: vi.fn((_options: unknown) => ({
    GET: mockHandler,
    POST: mockHandler,
    PUT: mockHandler,
  })),
}))

vi.mock('inngest/next', () => ({
  serve: mockServe,
}))

vi.mock('@/lib/edge-config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/edge-config')>()),
  getFeatureFlags: mockGetFeatureFlags,
}))

import * as route from '@/app/api/inngest/route'
import { inngest } from '@/lib/inngest/client'
import { DEFAULT_FEATURE_FLAGS } from '@/lib/edge-config'
import {
  cronJobFlags,
  eventFunctions,
} from '@/lib/inngest/registry'

type RegisteredFunction = {
  readonly opts: {
    readonly id: string
    readonly triggers: ReadonlyArray<{ readonly cron?: string }>
  }
}

const getFunctions = () =>
  mockServe.mock.calls.at(-1)?.[0].functions as RegisteredFunction[]

const invokeGet = () =>
  route.GET(new Request('https://localhost/api/inngest') as never, undefined)

const enabledFlags = (
  flag?: (typeof cronJobFlags)[keyof typeof cronJobFlags]
) => ({
  ...DEFAULT_FEATURE_FLAGS,
  ...(flag ? { [flag]: true } : {}),
})

describe('GET/POST/PUT /api/inngest', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('serves no cron triggers when all flags are disabled', async () => {
    mockGetFeatureFlags.mockResolvedValue(enabledFlags())

    await invokeGet()

    expect(mockServe).toHaveBeenCalledWith({
      client: inngest,
      functions: expect.any(Array),
    })
    expect(
      getFunctions().flatMap((fn) =>
        fn.opts.triggers.filter((trigger) => trigger.cron)
      )
    ).toHaveLength(0)
    expect(getFunctions()).toEqual(expect.arrayContaining([...eventFunctions]))
    expect(getFunctions()).toHaveLength(eventFunctions.length + 1)
  })

  it.each(Object.entries(cronJobFlags))(
    'serves only the %s cron when its flag is enabled',
    async (id, flag) => {
      mockGetFeatureFlags.mockResolvedValue(enabledFlags(flag))

      await invokeGet()

      const registeredCronFunctions = getFunctions().filter((fn) =>
        fn.opts.triggers.some((trigger) => trigger.cron)
      )
      expect(registeredCronFunctions.map((fn) => fn.opts.id)).toEqual([id])
    }
  )

  it('fails closed without affecting event functions', async () => {
    mockGetFeatureFlags.mockRejectedValue(new Error('Edge Config unavailable'))

    await invokeGet()

    expect(
      getFunctions().every((fn) =>
        fn.opts.triggers.every((trigger) => !trigger.cron)
      )
    ).toBe(true)
    expect(getFunctions()).toEqual(expect.arrayContaining([...eventFunctions]))
    expect(getFunctions()).toHaveLength(eventFunctions.length + 1)
  })

  it('keeps product affinity event-only until its cron flag is enabled', async () => {
    mockGetFeatureFlags.mockResolvedValueOnce(enabledFlags())

    await invokeGet()

    let affinity = getFunctions().find(
      (fn) => fn.opts.id === 'compute-product-affinity'
    )
    expect(affinity?.opts.triggers).toEqual([
      { event: 'recommendations/affinity.recompute' },
    ])

    mockGetFeatureFlags.mockResolvedValueOnce(
      enabledFlags('enableProductAffinityJob')
    )
    await invokeGet()

    affinity = getFunctions().find(
      (fn) => fn.opts.id === 'compute-product-affinity'
    )
    expect(affinity?.opts.triggers).toContainEqual({ cron: '0 4 * * *' })
  })

  it('exports all Inngest HTTP methods', () => {
    expect(route.GET).toBeDefined()
    expect(route.POST).toBeDefined()
    expect(route.PUT).toBeDefined()
  })

  it('bounds a step invocation to the claim-holder budget', () => {
    // Longer than STALE_PROCESSING_CLAIM_MS would let a live claim be stolen.
    expect(route.maxDuration).toBe(30)
    // Under Cache Components route handlers are dynamic unless they opt into
    // `"use cache"`, so the legacy `dynamic = 'force-dynamic'` export is gone.
    expect((route as { dynamic?: string }).dynamic).toBeUndefined()
  })
})
