import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockInsert,
  mockUpdate,
  mockSelect,
  mockLogBusinessEvent,
  mockLogError,
  mockSendEmail,
  mockFindFirst,
} = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockSelect: vi.fn(),
  mockLogBusinessEvent: vi.fn(),
  mockLogError: vi.fn(),
  mockSendEmail: vi.fn(),
  mockFindFirst: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  drizzleDb: {
    insert: mockInsert,
    update: mockUpdate,
    select: mockSelect,
    query: {
      failedEmails: {
        findFirst: mockFindFirst,
      },
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  logError: mockLogError,
  logBusinessEvent: mockLogBusinessEvent,
}))

vi.mock('@/lib/email/providers', () => ({
  sendEmail: mockSendEmail,
}))

import {
  saveFailedEmail,
  markFailedEmailSent,
  getFailedEmails,
  retryFailedEmail,
  batchRetryFailedEmails,
  acknowledgePendingEmails,
  countPendingFailedEmails,
  getRetriableFailedEmails,
} from '@/lib/email/failed-emails'

describe('lib/email/failed-emails', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('saveFailedEmail', () => {
    it('inserts a record and returns the id', async () => {
      const chainMock = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: 'abc1234' }]),
      }
      mockInsert.mockReturnValue(chainMock)

      const id = await saveFailedEmail({
        recipientEmail: 'user@test.com',
        subject: 'Test Subject',
        bodyHtml: '<p>Hello</p>',
        bodyText: 'Hello',
        emailType: 'order_confirmation',
        referenceId: 'ord1234',
        errorHistory: [],
        isRetriable: true,
        attemptCount: 3,
        lastError: 'ETIMEDOUT',
      })

      expect(id).toBe('abc1234')
      expect(mockInsert).toHaveBeenCalled()
      expect(mockLogBusinessEvent).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'failed_email_saved', success: true })
      )
    })
  })

  describe('markFailedEmailSent', () => {
    it('updates status to sent', async () => {
      const chainMock = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      }
      mockUpdate.mockReturnValue(chainMock)

      await markFailedEmailSent('abc1234')

      expect(mockUpdate).toHaveBeenCalled()
      expect(chainMock.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'sent' })
      )
    })
  })

  describe('getFailedEmails', () => {
    it('returns records with pagination', async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue([{ id: 'fe1' }]),
      }
      const countChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ value: 1 }]),
      }
      mockSelect
        .mockReturnValueOnce(selectChain)
        .mockReturnValueOnce(countChain)

      const result = await getFailedEmails({ page: 1, pageSize: 10 })

      expect(result.records).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('returns 0 total when no count rows', async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue([]),
      }
      const countChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      }
      mockSelect
        .mockReturnValueOnce(selectChain)
        .mockReturnValueOnce(countChain)

      const result = await getFailedEmails()

      expect(result.total).toBe(0)
    })

    it('uses ascending sort order', async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue([]),
      }
      const countChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      }
      mockSelect
        .mockReturnValueOnce(selectChain)
        .mockReturnValueOnce(countChain)

      await getFailedEmails({ sortOrder: 'asc' })

      expect(selectChain.orderBy).toHaveBeenCalled()
    })
  })

  describe('retryFailedEmail', () => {
    it('returns not found when record does not exist', async () => {
      mockFindFirst.mockResolvedValue(null)

      const result = await retryFailedEmail('missing-id')

      expect(result).toEqual({
        id: 'missing-id',
        success: false,
        error: 'Record not found',
      })
    })

    it('returns success for already-sent record', async () => {
      mockFindFirst.mockResolvedValue({ id: 'fe1', status: 'sent' })

      const result = await retryFailedEmail('fe1')

      expect(result).toEqual({ id: 'fe1', success: true })
    })

    it('retries and marks as sent on success', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'fe1',
        status: 'failed',
        recipientEmail: 'user@test.com',
        subject: 'Test',
        bodyHtml: '<p>Hi</p>',
        bodyText: 'Hi',
        attemptCount: 2,
        errorHistory: [],
      })
      mockSendEmail.mockResolvedValue(undefined)
      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      }
      mockUpdate.mockReturnValue(updateChain)

      const result = await retryFailedEmail('fe1')

      expect(result).toEqual({ id: 'fe1', success: true })
      expect(mockSendEmail).toHaveBeenCalled()
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'sent' })
      )
    })

    it('handles retry failure', async () => {
      mockFindFirst.mockResolvedValue({
        id: 'fe1',
        status: 'failed',
        recipientEmail: 'user@test.com',
        subject: 'Test',
        bodyHtml: '<p>Hi</p>',
        bodyText: 'Hi',
        attemptCount: 2,
        errorHistory: [],
      })
      mockSendEmail.mockRejectedValue(new Error('SMTP error'))
      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      }
      mockUpdate.mockReturnValue(updateChain)

      const result = await retryFailedEmail('fe1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('SMTP error')
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' })
      )
    })
  })

  describe('batchRetryFailedEmails', () => {
    it('retries multiple emails', async () => {
      mockFindFirst
        .mockResolvedValueOnce({ id: 'fe1', status: 'sent' })
        .mockResolvedValueOnce(null)

      const results = await batchRetryFailedEmails(['fe1', 'fe2'])

      expect(results).toHaveLength(2)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(false)
    })
  })

  describe('acknowledgePendingEmails', () => {
    it('marks pending emails as failed', async () => {
      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      }
      mockUpdate.mockReturnValue(updateChain)

      await acknowledgePendingEmails(['fe1', 'fe2'])

      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' })
      )
    })

    it('does nothing for empty array', async () => {
      await acknowledgePendingEmails([])

      expect(mockUpdate).not.toHaveBeenCalled()
    })
  })

  describe('countPendingFailedEmails', () => {
    it('returns count from DB', async () => {
      const chainMock = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ value: 5 }]),
      }
      mockSelect.mockReturnValue(chainMock)

      const result = await countPendingFailedEmails()
      expect(result).toBe(5)
    })

    it('returns 0 when no rows returned', async () => {
      const chainMock = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      }
      mockSelect.mockReturnValue(chainMock)

      const result = await countPendingFailedEmails()
      expect(result).toBe(0)
    })
  })

  describe('getRetriableFailedEmails', () => {
    it('returns retriable emails with attempts under limit', async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          { id: 'fe1', attemptCount: 2 },
          { id: 'fe2', attemptCount: 6 },
        ]),
      }
      mockSelect.mockReturnValue(selectChain)

      const result = await getRetriableFailedEmails()

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('fe1')
    })
  })
})
