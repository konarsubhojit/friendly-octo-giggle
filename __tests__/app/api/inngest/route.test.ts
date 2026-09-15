import { afterEach, describe, it, expect, vi } from 'vitest'

const { mockGetFeatureFlags, mockInvokedServeOptions, mockServe } =
  vi.hoisted(() => {
    const mockGetFeatureFlags = vi.fn()
    const mockHandler = vi.fn(() => Promise.resolve(new Response()))
    const mockInvokedServeOptions = vi.fn()
    const mockServe = vi.fn((options: unknown) => {
      const handler = vi.fn(() => {
        mockInvokedServeOptions(options)
        return mockHandler()
      })

      return { GET: handler, POST: handler, PUT: handler }
    })

    return {
      mockGetFeatureFlags,
      mockInvokedServeOptions,
      mockServe,
    }
  })

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
  inngestFunctions,
} from '@/lib/inngest/registry'

type RegisteredFunction = {
  readonly opts: {
    readonly id: string
    readonly triggers: ReadonlyArray<{ readonly cron?: string }>
  }
}

const getFunctions = () =>
  (
    mockServe.mock.calls.at(-1)?.[0] as
      | { readonly functions: RegisteredFunction[] }
      | undefined
  )?.functions ?? []

const invokeGet = () =>
  route.GET(new Request('https://localhost/api/inngest') as never, undefined)

const invokePost = () =>
  route.POST(new Request('https://localhost/api/inngest') as never, undefined)

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

  it('keeps the complete registry available for queued executions', async () => {
    await invokePost()

    const options = mockInvokedServeOptions.mock.calls.at(-1)?.[0] as {
      readonly functions: RegisteredFunction[]
    }
    expect(options.functions.map((fn) => fn.opts.id).sort()).toEqual(
      inngestFunctions.map((fn) => fn.opts.id).sort()
    )
    expect(mockGetFeatureFlags).not.toHaveBeenCalled()
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
