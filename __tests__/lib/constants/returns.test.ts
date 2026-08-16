import { describe, expect, it } from 'vitest'
import { isReturnReason, isReturnStatus } from '@/lib/constants/returns'

describe('return constants', () => {
  it('recognizes only supported statuses and reasons', () => {
    expect(isReturnStatus('REQUESTED')).toBe(true)
    expect(isReturnStatus('UNKNOWN')).toBe(false)
    expect(isReturnStatus(null)).toBe(false)
    expect(isReturnReason('DAMAGED')).toBe(true)
    expect(isReturnReason('CHANGED_MIND')).toBe(false)
    expect(isReturnReason(1)).toBe(false)
  })
})
