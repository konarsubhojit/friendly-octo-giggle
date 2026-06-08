// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'

import { ServiceWorkerRegistration } from '@/components/pwa/ServiceWorkerRegistration'

type SwRegisterOptions = { scope?: string; updateViaCache?: string }

const registerMock =
  vi.fn<(script: string, options?: SwRegisterOptions) => Promise<unknown>>()

const installingListeners = new Map<string, () => void>()
const registrationListeners = new Map<string, () => void>()

const installingWorker = {
  state: 'installed' as ServiceWorker['state'],
  postMessage: vi.fn(),
  addEventListener: vi.fn((event: string, cb: () => void) => {
    installingListeners.set(event, cb)
  }),
}

const fakeRegistration = {
  installing: installingWorker,
  addEventListener: vi.fn((event: string, cb: () => void) => {
    registrationListeners.set(event, cb)
  }),
}

function installServiceWorkerApi(controller: ServiceWorker | null) {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      register: registerMock,
      controller,
    },
  })
}

describe('ServiceWorkerRegistration', () => {
  beforeEach(() => {
    registerMock.mockReset()
    installingListeners.clear()
    registrationListeners.clear()
    fakeRegistration.addEventListener.mockClear()
    installingWorker.addEventListener.mockClear()
    installingWorker.postMessage.mockClear()
    installingWorker.state = 'installed'
    registerMock.mockResolvedValue(fakeRegistration)
  })

  afterEach(() => {
    // Remove the override so other suites see the original navigator
    Reflect.deleteProperty(navigator, 'serviceWorker')
  })

  it('does nothing when the browser has no service-worker support', () => {
    // Ensure serviceWorker key is missing
    expect('serviceWorker' in navigator).toBe(false)

    const { container } = render(<ServiceWorkerRegistration />)

    expect(container.firstChild).toBeNull()
    expect(registerMock).not.toHaveBeenCalled()
  })

  it('registers immediately when document.readyState is complete', async () => {
    installServiceWorkerApi(null)
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      value: 'complete',
    })

    render(<ServiceWorkerRegistration />)

    // Allow the microtask queue to drain the async register call
    await Promise.resolve()
    await Promise.resolve()

    expect(registerMock).toHaveBeenCalledWith('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    })
    expect(fakeRegistration.addEventListener).toHaveBeenCalledWith(
      'updatefound',
      expect.any(Function)
    )
  })

  it('defers registration until window load when document is still loading', async () => {
    installServiceWorkerApi(null)
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      value: 'loading',
    })

    render(<ServiceWorkerRegistration />)

    expect(registerMock).not.toHaveBeenCalled()

    window.dispatchEvent(new Event('load'))
    await Promise.resolve()
    await Promise.resolve()

    expect(registerMock).toHaveBeenCalledTimes(1)
  })

  it('posts SKIP_WAITING to a freshly installed worker when a controller is active', async () => {
    installServiceWorkerApi({} as ServiceWorker)
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      value: 'complete',
    })

    render(<ServiceWorkerRegistration />)
    await Promise.resolve()
    await Promise.resolve()

    // Simulate the registration emitting updatefound
    registrationListeners.get('updatefound')?.()
    // Simulate the new worker reaching the 'installed' state
    installingWorker.state = 'installed'
    installingListeners.get('statechange')?.()

    expect(installingWorker.postMessage).toHaveBeenCalledWith({
      type: 'SKIP_WAITING',
    })
  })

  it('does not post SKIP_WAITING when there is no active controller', async () => {
    installServiceWorkerApi(null)
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      value: 'complete',
    })

    render(<ServiceWorkerRegistration />)
    await Promise.resolve()
    await Promise.resolve()

    registrationListeners.get('updatefound')?.()
    installingListeners.get('statechange')?.()

    expect(installingWorker.postMessage).not.toHaveBeenCalled()
  })

  it('swallows registration errors silently', async () => {
    installServiceWorkerApi(null)
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      value: 'complete',
    })
    registerMock.mockRejectedValueOnce(new Error('fail'))

    expect(() => render(<ServiceWorkerRegistration />)).not.toThrow()

    await Promise.resolve()
    await Promise.resolve()

    expect(registerMock).toHaveBeenCalled()
  })
})
