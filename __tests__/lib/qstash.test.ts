import { describe, it, expect, vi, beforeEach } from 'vitest'

const { MockClient, MockReceiver } = vi.hoisted(() => ({
  MockClient: vi.fn(),
  MockReceiver: vi.fn(),
}))

vi.mock('@upstash/qstash', () => ({
  Client: MockClient,
  Receiver: MockReceiver,
}))

vi.mock('@/lib/env', () => ({
  env: {
    QSTASH_TOKEN: 'test-token',
    QSTASH_CURRENT_SIGNING_KEY: 'test-current-key',
    QSTASH_NEXT_SIGNING_KEY: 'test-next-key',
  },
}))

import { getQStashClient, getQStashReceiver } from '@/lib/qstash'

describe('lib/qstash', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    MockClient.mockImplementation(function (this: unknown) {
      Object.assign(this as object, { type: 'client' })
    })
    MockReceiver.mockImplementation(function (this: unknown) {
      Object.assign(this as object, { type: 'receiver' })
    })
  })

  describe('getQStashClient', () => {
    it('returns a Client instance', () => {
      const client = getQStashClient()
      expect(MockClient).toHaveBeenCalledOnce()
      expect(client).toBeInstanceOf(MockClient)
    })

    it('passes QSTASH_TOKEN from env to Client constructor', () => {
      getQStashClient()
      expect(MockClient).toHaveBeenCalledWith({ token: 'test-token' })
    })
  })

  describe('getQStashReceiver', () => {
    it('returns a Receiver instance', () => {
      const receiver = getQStashReceiver()
      expect(MockReceiver).toHaveBeenCalledOnce()
      expect(receiver).toBeInstanceOf(MockReceiver)
    })

    it('passes signing keys from env to Receiver constructor', () => {
      getQStashReceiver()
      expect(MockReceiver).toHaveBeenCalledWith({
        currentSigningKey: 'test-current-key',
        nextSigningKey: 'test-next-key',
      })
    })
  })
})
